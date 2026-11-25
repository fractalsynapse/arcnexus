import type { Context } from 'cordis';
import { z } from 'zod';
import type { Capture } from '../../architecture/src/index.js';
import { dataOperation, type DataScope } from '../../data/src/index.js';
import { guideMetadata } from './guide-metadata.js';
import { goalDirectory, readGoal } from './inventory.js';
import {
  guideDifference,
  guideFile,
  guideHistory,
  guideSummaries,
  type GuideKind,
} from './guide-data.js';

const revision = z.string().optional();
const listInput = z.strictObject({ revision, search: z.string().optional() });
const item = z.strictObject({ revision, id: z.string() });
const readInput = item.extend({ fileRevision: z.string().optional() });

export type ResolvePlanCapture = (
  scope: DataScope,
  revision?: string,
) => Capture | undefined | Promise<Capture | undefined>;

/** Resolve guide identities inside the Planner's captured collection. */
function guideDirectory(kind: GuideKind, capture: Capture) {
  return kind === 'goals'
    ? goalDirectory(capture)
    : (capture.project.knowledgeRoot ?? '.arc') + '/objectives';
}

function entries(kind: GuideKind, capture: Capture) {
  const prefix = guideDirectory(kind, capture) + '/';
  return capture.source.paths.flatMap((path) => {
    if (!path.startsWith(prefix) || !path.endsWith('.md')) return [];
    const id = path.slice(prefix.length, -3);
    return id && !id.includes('/') ? [{ id, path }] : [];
  });
}

function describe(kind: GuideKind, entry: { id: string; path: string }, content: string) {
  const fields = guideMetadata(content);
  if (kind === 'goals') fields.priority = readGoal(entry.id, content).priority;
  return { ...entry, ...fields };
}

function fileAt(
  capture: Capture,
  path: string,
  fileRevision?: string,
  history?: ReturnType<NonNullable<Capture['source']['fileHistory']>>,
) {
  if (!fileRevision || fileRevision === capture.source.revision) return capture.source.read(path);
  const selected = history ?? capture.source.fileHistory?.(path);
  if (!selected) throw new Error('File history unavailable');
  return selected.read(fileRevision);
}

/** Resolve exact project and file authorization before handling historical reads. */
function guideResources(kind: GuideKind, resolve: ResolvePlanCapture) {
  const open = async (scope: DataScope, expected?: string) => {
    const capture = await resolve(scope, expected);
    if (!capture || (expected !== undefined && expected !== capture.source.revision))
      throw new Error('Plan revision unavailable');
    return capture;
  };
  const locate = async (scope: DataScope, input: z.output<typeof item>) => {
    const capture = await open(scope, input.revision);
    const entry = entries(kind, capture).find(({ id }) => id === input.id);
    if (!entry) throw new Error('Plan file unavailable');
    return { capture, entry };
  };
  return { open, locate };
}

function listEntries(kind: GuideKind, capture: Capture, search = '') {
  const query = search.trim().toLocaleLowerCase();
  const dates = capture.source.fileDates?.(guideDirectory(kind, capture));
  return entries(kind, capture).flatMap((entry) => {
    const content = capture.source.read(entry.path);
    if (
      query &&
      !entry.id.toLocaleLowerCase().includes(query) &&
      !content.toLocaleLowerCase().includes(query)
    )
      return [];
    return [{ ...describe(kind, entry, content), updated: dates?.get(entry.path) }];
  });
}

function changes(capture: Capture, path: string, revision?: string) {
  const history = capture.source.fileHistory?.(path);
  const after = fileAt(capture, path, revision, history);
  const index =
    revision && revision !== capture.source.revision
      ? (history?.revisions.findIndex((entry) => entry.revision === revision) ?? -1)
      : 0;
  const previous = history?.revisions[index + 1]?.revision;
  return { path, after, before: previous ? history!.read(previous) : '' };
}

/** Publish independent guide collection, file and revision resources. */
function guides(kind: GuideKind, resolve: ResolvePlanCapture) {
  const { open, locate } = guideResources(kind, resolve);
  return {
    id: kind,
    operations: {
      list: guideList(kind, open),
      read: dataOperation(readInput, guideFile, async (scope, input) => {
        const { capture, entry } = await locate(scope, input);
        const content = fileAt(capture, entry.path, input.fileRevision);
        return {
          revision: capture.source.revision,
          entry: describe(kind, entry, content),
          content,
        };
      }),
      revisions: dataOperation(item, guideHistory, async (scope, input) => {
        const { capture, entry } = await locate(scope, input);
        return { revisions: [...(capture.source.fileHistory?.(entry.path).revisions ?? [])] };
      }),
      changes: dataOperation(readInput, guideDifference, async (scope, input) => {
        const { capture, entry } = await locate(scope, input);
        return changes(capture, entry.path, input.fileRevision);
      }),
    },
  };
}

/** Publish the Planner-owned guide collections without invoking a planning workflow. */
export function plannerDataPlugin(resolve: ResolvePlanCapture) {
  return {
    inject: ['data'],
    /** Register both guide collections for the selected trusted project. */
    apply(context: Context) {
      context.effect(() => context.data.register(guides('goals', resolve)));
      context.effect(() => context.data.register(guides('objectives', resolve)));
    },
  };
}

function guideList(kind: GuideKind, open: ReturnType<typeof guideResources>['open']) {
  return dataOperation(listInput, guideSummaries, async (scope, input) => {
    const capture = await open(scope, input.revision);
    return {
      revision: capture.source.revision,
      entries: listEntries(kind, capture, input.search),
    };
  });
}
