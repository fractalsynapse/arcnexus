import { parseDocument, isMap, isSeq, type YAMLMap, type Document } from 'yaml';
import { acceptanceScenarios, textDigest, type ContentPatch } from '../../foundation/src/index.js';
import type { Capture } from './catalog.js';
import { ArchitectureResponseError } from './proposal.js';

/** Include exact registry changes in the review batch before any approval is requested. */
export function amendArchitectureRegistry(capture: Capture, files: ContentPatch[], intent: string) {
  const path = capture.project.contractRegistry;
  const requested = files.find((file) => file.path === path);
  if (requested)
    throw new ArchitectureResponseError(
      'The host derives registry amendments from contract changes and includes their exact bytes before approval; omit a separate registry edit',
    );
  const before = capture.source.read(path);
  const document = parseDocument(before);
  if (document.errors.length)
    throw new ArchitectureResponseError(`Invalid registry: ${document.errors[0]!.message}`);
  const entries = document.get('contracts', true);
  if (!isSeq(entries)) throw new ArchitectureResponseError('Registry contracts must be a sequence');
  const changed = entries.items.filter((entry) => {
    if (!isMap(entry)) throw new ArchitectureResponseError('Invalid registry contract entry');
    return amendEntry(document, entry, files, capture, intent);
  });
  if (!changed.length) return files;
  document.setIn(['authority', 'approvedBase'], capture.source.revision);
  document.setIn(
    ['authority', 'approvalRecord'],
    `Exact proposal intent ${intent}; human approval is required and recorded in Coordination before host application.`,
  );
  const content = document.toString();
  return [...files.filter((file) => file.path !== path), { path, before, content }];
}

/** Preserve prior lock history while deriving digest/count metadata from the proposed content. */
function amendEntry(
  document: Document,
  entry: YAMLMap,
  files: readonly ContentPatch[],
  capture: Capture,
  intent: string,
) {
  const path = String(entry.get('file'));
  const change = files.find((file) => file.path === path);
  if (!change) return false;
  if (change.content === null)
    throw new ArchitectureResponseError(`Registry still references deleted contract: ${path}`);
  const digest = textDigest(change.content);
  if (entry.get('digest') === digest) return false;
  rememberEntry(document, entry, capture, intent);
  entry.set('digest', digest);
  entry.set('scenarios', acceptanceScenarios(change.content).length);
  if (entry.get('stage') === 'locked') {
    entry.set('acceptedBy', document.getIn(['authority', 'lockOwner']) ?? 'human architect');
    entry.set('acceptedAt', new Date().toISOString().slice(0, 10));
    entry.set(
      'approvalRecord',
      `Exact proposal intent ${intent}; foreground human approval recorded in Coordination.`,
    );
  }
  return true;
}

/** Retain the complete prior contract metadata without recursively copying its earlier history. */
function rememberEntry(document: Document, entry: YAMLMap, capture: Capture, intent: string) {
  const { history: _history, ...before } = entry.toJSON() as Record<string, unknown>;
  const previous = {
    ...before,
    revision: capture.source.revision,
    note: `Replaced by human-reviewed proposal intent ${intent}.`,
  };
  const history = entry.get('history', true);
  if (isSeq(history)) history.add(previous);
  else if (history === undefined) entry.set('history', document.createNode([previous]));
  else throw new ArchitectureResponseError('Contract history must be a sequence');
}
