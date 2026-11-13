import { activityOperationIds } from './activities.js';
import {
  OperationArguments,
  OperationOrder,
  type OperationContext,
} from '../operations/operation-definition.js';
import type { Operation } from '../operations/operations.js';
import type { Catalog, Component } from './components.js';
import { InputError } from './config.js';
import { validateSchema } from './schema.js';
import { compiledTestPath } from '../testing/captured-tests.js';

/** Captures finite lifecycle plans and agent availability from a single definition registry. */
export class ComponentOperationPlans {
  /** Retains revision-bound definitions; no command executes during catalog resolution. */
  constructor(private readonly catalog: Catalog) {}

  /** Resolves every executable component independently of the number of participating owners. */
  resolve(): void {
    for (const c of Object.values(this.catalog.components)) {
      // Containers bind no operation plans of their own; leaves do, under the single component shape.
      if (['platform', 'package'].includes(c.type)) continue;
      c.operationPlan = {};
      const context = this.context(c);
      for (const usage of ['preflight', 'setup', 'refresh', 'verify', 'delivery', 'agent'])
        c.operationPlan[usage] = this.plan(c, context, usage);
      c.verification = c.operationPlan.verify!;
      this.services(c);
    }
  }

  /** Requires a declared agent-managed service for every captured finite HTTP checkpoint. */
  private services(component: Component): void {
    for (const op of Object.values(component.operationPlan!).flat()) {
      if (op.kind !== 'http') continue;
      const service = this.catalog.operations[op.http.serviceId];
      if (service?.kind !== 'service' || !component.operations?.[service.id]?.includes('agent'))
        throw new InputError(`HTTP operation requires declared agent service: ${op.id}`);
    }
  }

  /** Supplies only owner authority and validated test metadata captured by the host. */
  private context(c: Component): OperationContext {
    const profile = this.catalog.configurationSources.find(
      (s) =>
        s.path.startsWith('architecture/test-profiles/') &&
        (s.value as { id?: string }).id === c.testProfile,
    );
    return {
      ownerId: c.id,
      ownedPaths: [...c.allowedWritePaths],
      packageRoot: c.repositoryRoot!,
      ...(c.testProfile
        ? {
            selectedTestFiles: (c.capturedTests ?? []).map((t) =>
              compiledTestPath(c, t.source, (profile!.value as { outputRoot: string }).outputRoot),
            ),
            testOutputRoot: (profile?.value as { outputRoot?: string } | undefined)?.outputRoot,
          }
        : {}),
    };
  }

  /** Orders prerequisites and prevents services or incompatible owners from entering finite checkpoints. */
  private plan(c: Component, context: OperationContext, usage: string): Operation[] {
    const ids = Object.entries(c.operations ?? {})
      .filter(([, usages]) => usages.includes(usage))
      .map(([id]) => id);
    const profile = usage === 'verify' ? this.profileCheck(c) : undefined;
    const implicit = profile && !ids.includes(profile.run) ? profile : undefined;
    if (implicit) ids.push(implicit.run);
    return new OperationOrder(this.catalog.operations).resolve(ids).map((op) => {
      this.validate(c, op, usage);
      const profileVerification = implicit?.run === op.id ? implicit.id : undefined;
      return {
        ...new OperationArguments().capture(
          op,
          context,
          usage === 'agent' || !!profileVerification,
        ),
        ...(profileVerification ? { profileVerification } : {}),
      };
    });
  }

  /** Requires a shared test profile before a component may be assigned executable test work. */
  profileCheck(c: Component): { id: string; run: string } | undefined {
    if (!c.testProfile) return undefined;
    const source = this.catalog.configurationSources.find(
      (entry) =>
        entry.path.startsWith('architecture/test-profiles/') &&
        (entry.value as { id?: string }).id === c.testProfile,
    );

    // Architect ruling 2026-11-12: admission validates what it consumes. A profile reaching this
    // point came from a captured document list, not necessarily from a load that schema-checked it,
    // so a stale or fabricated shape must be refused here rather than acted upon.
    const profile = source
      ? validateSchema<{ id: string; run?: string }>('test-profile', source.value)
      : undefined;
    // A declared profile that resolves to nothing, or names no runner, cannot carry executable tests.
    if (!profile?.run)
      throw new InputError(`Test profile ${c.testProfile} declares no runner for ${c.id}`);
    return { id: profile.id, run: profile.run };
  }

  /** Resolves the runner a component's declared test profile names. */
  private validate(c: Component, op: Operation, usage: string): void {
    if (op.schemaVersion !== 4)
      throw new InputError(`Migrate operation ${op.id} to schemaVersion 4`);
    if (op.repository !== c.repository)
      throw new InputError(`Operation repository mismatch: ${op.id}`);
    if (usage !== 'agent' && ['service', 'upstream'].includes(op.kind))
      throw new InputError(`Required lifecycle operations must be finite: ${op.id}`);
    // Only agent-invoked operations are gated by an activity. Setup, preflight, refresh, verify and
    // delivery operations are host lifecycle steps chosen by the plan profile, so requiring every
    // component to attach them to an activity would invent an activity for work no agent performs.
    if (
      (c.operations?.[op.id] ?? []).includes('agent') &&
      !Object.values(c.activities ?? {}).some((a) => activityOperationIds(a).includes(op.id))
    )
      throw new InputError(`Agent operation belongs to no declared activity: ${op.id}`);
    for (const id of [
      c.executionProfile,
      ...Object.values(c.activities ?? {}).flatMap((a) => (a.profile ? [a.profile] : [])),
    ])
      if (!this.catalog.profiles[id]!.operationCategories?.includes(op.category))
        throw new InputError(`Operation category not permitted by ${id}: ${op.id}`);
  }
}
