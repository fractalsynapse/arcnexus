interface ReadBinding {
  token: string;
  request?: typeof fetch;
}

/** Verify exact GitHub source using a repository-scoped read credential. */
export async function verifyBoundCommit(remote: string, revision: string, binding: ReadBinding) {
  const target = /^https:\/\/github\.com\/([\w-]+)\/([\w-][\w.-]*)\.git$/.exec(remote);
  if (!target || !/^[a-f0-9]{40}$/.test(revision)) throw new Error('Invalid GitHub commit binding');
  const [, owner, repository] = target;
  const url =
    'https://api.github.com/repos/' + owner + '/' + repository + '/git/commits/' + revision;
  const response = await (binding.request ?? fetch)(url, {
    redirect: 'error',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: 'Bearer ' + binding.token,
      'x-github-api-version': '2026-03-10',
    },
  });
  if (!response.ok) throw new Error('The configured GitHub binding could not verify this commit');
  const verified = (await response.json()) as { sha?: string };
  if (verified.sha !== revision) throw new Error('GitHub returned a different commit');
}
