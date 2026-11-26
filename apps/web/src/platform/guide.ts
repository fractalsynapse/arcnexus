import type { Guide, GuideKind } from '../../../../packages/planner/src/guide-data.js';
export type {
  Guide,
  GuideCollection,
  GuideDifference,
  GuideFile,
  GuideHistory,
  GuideKind,
  GuideRevision,
} from '../../../../packages/planner/src/guide-data.js';

export const planFilesPath = '/plan/files/';

/** Decode a dedicated file route with an optional exact repository capture. */
export function guideRoute(path: string) {
  const address = new URL(path, 'https://arcnexus.invalid');
  const match = /^\/plan\/files\/(goals|objectives)\/([a-z0-9][a-z0-9-]*)\/?$/.exec(
    address.pathname,
  );
  if (!match) return;
  return {
    kind: match[1] as GuideKind,
    id: match[2]!,
    project: address.searchParams.get('project') ?? undefined,
    revision: address.searchParams.get('revision') ?? undefined,
  };
}

/** Keep a file link pinned to the source of its row. */
export function guideLink(kind: GuideKind, id: string, project: string, revision: string) {
  return (
    planFilesPath +
    kind +
    '/' +
    encodeURIComponent(id) +
    '/?' +
    new URLSearchParams({ project, revision })
  );
}

export function guideType(kind: GuideKind) {
  return kind === 'goals' ? 'Goal' : 'Objective';
}

/** Use the captured category and basename to show the path within the guide collection. */
export function guideRelativePath({ path, category }: Guide) {
  const filename = guideFilename(path);
  return category ? `${category}/${filename}` : filename;
}

/** Present the file name while links retain the guide's stable record ID. */
export function guideName({ path, name }: Guide) {
  const basename = guideFilename(path).replace(/\.md$/, '');
  if (/^[a-f0-9]{64}$/.test(basename)) return name ?? 'Untitled guide';
  return basename || name || 'Untitled guide';
}

function guideFilename(path: string) {
  return path.slice(path.lastIndexOf('/') + 1);
}
