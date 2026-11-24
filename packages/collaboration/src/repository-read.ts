interface ReadBinding {
  token: string;
  request?: typeof fetch;
}

export function githubRepository(remote: string) {
  return /^https:\/\/github\.com\/([\w-]+)\/([\w-][\w.-]*)\.git$/.exec(remote);
}

export function githubReadHeaders(token: string) {
  return {
    accept: 'application/vnd.github+json',
    authorization: 'Bearer ' + token,
    'x-github-api-version': '2026-03-10',
  };
}

/** Verify exact GitHub source using a repository-scoped read credential. */
export async function verifyBoundCommit(remote: string, revision: string, binding: ReadBinding) {
  const target = githubRepository(remote);
  if (!target || !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid GitHub commit binding');
  const [, owner, repository] = target;
  const url =
    'https://api.github.com/repos/' + owner + '/' + repository + '/git/commits/' + revision;
  const response = await (binding.request ?? fetch)(url, {
    redirect: 'error',
    headers: githubReadHeaders(binding.token),
  });
  if (!response.ok) throw new Error('The configured GitHub binding could not verify this commit');
  const verified = (await response.json()) as { sha?: string };
  if (verified.sha !== revision) throw new Error('GitHub returned a different commit');
}
