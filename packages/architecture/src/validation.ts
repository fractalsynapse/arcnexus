import assert from 'node:assert/strict';
import { ownershipFindings, ownershipDiagnostic } from './ownership.js';
import { team } from '../../team/src/index.js';
import type { Capture } from './catalog.js';
import { buildCodexRequest } from './request.js';
import { operationID, resolveOperation } from './operation.js';

/** Validate the resolved architecture using the same Team, bindings and request builder as activation. */
export function validateCapture(capture: Capture) {
  validateOwnership(capture);
  for (const component of team.list(capture.components)) {
    assert(component.purpose?.trim(), `Missing purpose: ${component.id}`);
    for (const [activity, mapping] of Object.entries(component.activities)) {
      const scope = `${component.id}/${activity}`;
      if (mapping.executor !== 'host')
        buildCodexRequest(capture, { component: component.id, activity });
      const ids = mapping.operations.map(operationID);
      assert.equal(new Set(ids).size, ids.length, `${scope}: duplicate operation bindings`);
      for (const id of mapping.verification ?? []) {
        assert(ids.includes(id), `${scope}: unmapped verification ${id}`);
        const operation = resolveOperation(capture, id, component.id, activity);
        assert(
          operation.command && operation.tool === 'check',
          `${scope}: invalid verification ${id}`,
        );
      }
    }
  }
  for (const binding of [
    capture.project.director,
    capture.project.verifier,
    capture.project.architect,
  ]) {
    if (binding) buildCodexRequest(capture, binding);
  }
}

/** Refuse the complete captured inventory with every Team path and conflicting owner intact. */
function validateOwnership(capture: Capture) {
  const findings = ownershipFindings(capture.components, capture.source.paths);
  if (findings.length) throw new Error(ownershipDiagnostic(findings));
}
