import type { GuideHistory, GuideRevision } from './guide.js';
import { useResource } from './resource.js';

export const capturedVersion = '@capture';

/** Resolve file commits through an approved capture that contains them. */
export function useFileRevisions(base: string | undefined, pinned?: string, current?: string) {
  const captured = useResource<GuideHistory>(historyPath(base, pinned));
  const project = useResource<GuideHistory>(
    current !== pinned ? historyPath(base, current) : undefined,
  );
  const latest = current === pinned ? captured : project;
  const historical = current !== pinned;
  return {
    captured,
    latest,
    historical,
    initial: historical ? capturedVersion : '',
    address: (version: string) => {
      if (!version)
        return { revision: current, fileRevision: latest.value?.revisions[0]?.revision };
      if (version === capturedVersion)
        return { revision: pinned, fileRevision: captured.value?.revisions[0]?.revision };
      const inLatest = latest.value?.revisions.some((entry) => entry.revision === version);
      return { revision: inLatest ? current : pinned, fileRevision: version };
    },
  };
}

function historyPath(base?: string, revision?: string) {
  return base && revision ? base + '/revisions?' + new URLSearchParams({ revision }) : undefined;
}

/** Combine the visible commit histories when an older capture is pinned in the link. */
export function historicalRevisions(
  latest: readonly GuideRevision[],
  captured: readonly GuideRevision[],
) {
  return [
    ...new Map([...latest, ...captured].map((entry) => [entry.revision, entry])).values(),
  ].sort((left, right) => Date.parse(right.updated) - Date.parse(left.updated));
}
