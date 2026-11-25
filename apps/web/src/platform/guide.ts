import type { GuideKind } from '../../../../packages/planner/src/guide-data.js';
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
    revision: address.searchParams.get('revision') ?? undefined,
  };
}

/** Keep a file link pinned to the source of its row. */
export function guideLink(kind: GuideKind, id: string, revision: string) {
  return (
    planFilesPath + kind + '/' + encodeURIComponent(id) + '/?' + new URLSearchParams({ revision })
  );
}

export function guideType(kind: GuideKind) {
  return kind === 'goals' ? 'Goal' : 'Objective';
}
