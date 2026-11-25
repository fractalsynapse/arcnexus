import { createElement as h } from 'react';

function repository(remote: string | undefined) {
  const url = remote && URL.parse(remote);
  if (!url || url.origin !== 'https://github.com') return;
  const path = url.pathname.replace(/\/$|\.git$/g, '');
  if (!/^\/[\w.-]+\/[\w.-]+$/.test(path)) return;
  return url.origin + path;
}

export function issueLink(remote: string | undefined, issue: string) {
  const root = repository(remote);
  if (root && /^\d+$/.test(issue)) return root + '/issues/' + issue;
}

export function pullLink(remote: string | undefined, url: string) {
  const root = repository(remote);
  if (root && url.startsWith(root + '/pull/') && /^\d+$/.test(url.slice(root.length + 6)))
    return url;
}

export function shortCommit(revision: string) {
  return revision.slice(0, 8);
}

/** Keep an exact captured Git identity navigable with a compact label. */
export function CommitLink({ remote, revision }: { remote?: string; revision?: string }) {
  if (!revision) return 'Unavailable';
  const root = repository(remote);
  const href = root && /^[\da-f]+$/i.test(revision) ? root + '/commit/' + revision : undefined;
  return href
    ? h(
        'a',
        { href, target: '_blank', rel: 'noopener noreferrer', title: revision },
        shortCommit(revision),
      )
    : h('code', null, revision);
}
