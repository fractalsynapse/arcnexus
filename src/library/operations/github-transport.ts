/** Sends repository-scoped GitHub API requests while keeping credentials outside evidence and worker environments. */
export class GitHubTransport {
  /** Captures one explicit upstream and an injectable transport boundary for deterministic acceptance. */
  constructor(
    readonly repository: string,
    private readonly credential: (() => Promise<string>) | undefined,
    private readonly transport: typeof fetch = fetch,
  ) {
    if (
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
      repository.split('/').some((part) => part === '.' || part === '..')
    )
      throw new Error('Expected an explicit GitHub owner/repository');
  }

  /** Rejects path escape and redirects before credentials can reach another destination. */
  async request(path: string, signal: AbortSignal, method = 'GET', body?: object): Promise<any> {
    return this.send(this.scope(path, method), signal, method, body);
  }

  /** Resolves a captured branch to its immutable Git commit before live work is admitted. */
  async branchHead(branch: string, signal: AbortSignal): Promise<string> {
    const url = this.scope('/git/ref/heads/' + encodeURIComponent(branch), 'GET');
    const ref = await this.send(url, signal, 'GET', undefined, true);
    const sha = ref.object?.sha;
    if (
      ref.ref !== 'refs/heads/' + branch ||
      ref.object?.type !== 'commit' ||
      typeof sha !== 'string' ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)
    )
      throw new Error('GitHub target revision is unavailable');
    return sha;
  }

  /** Reads provider-computed PR gates using a fixed query and captured repository variables. */
  async pullRequest(number: number, signal: AbortSignal): Promise<any> {
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Invalid PR identity');
    const [owner, name] = this.repository.split('/');
    const query = `query($owner:String!,$name:String!,$number:Int!) {
      repository(owner:$owner,name:$name) { nameWithOwner defaultBranchRef { name }
        pullRequest(number:$number) { number url state isDraft headRefOid headRefName
          headRepository { nameWithOwner } baseRefName baseRefOid
          mergeable mergeStateStatus reviewDecision
          commits(last:1) { nodes { commit { oid statusCheckRollup {
            state contexts { totalCount }
          } } } }
        }
      }
    }`;
    const result = await this.send('https://api.github.com/graphql', signal, 'POST', {
      query,
      variables: { owner, name, number },
    });
    if (result.errors?.length || result.data?.repository?.nameWithOwner !== this.repository)
      throw new Error('GitHub readiness response is incomplete or outside captured repository');
    return result.data.repository;
  }

  /** Keeps authenticated transport identical for scoped REST mutations and fixed GraphQL observations. */
  private async send(
    url: string,
    signal: AbortSignal,
    method: string,
    body?: object,
    publicRead = false,
  ): Promise<any> {
    signal.throwIfAborted();
    const token = await this.credential?.();
    if (!token?.trim() && !publicRead) throw new Error('GitHub host credential is unavailable');
    signal.throwIfAborted();
    const response = await this.transport(url, {
      method,
      signal,
      redirect: 'error',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw Object.assign(new Error(`GitHub request failed with HTTP ${response.status}`), {
        status: response.status,
      });
    return response.status === 204 ? undefined : response.json();
  }

  /** Validates decoded path segments and final URL containment before acquiring a credential. */
  private scope(path: string, method: string): string {
    const decoded = decodeURIComponent(path.split('?')[0]!);
    if (
      (path !== '' && !path.startsWith('/')) ||
      path.startsWith('//') ||
      /[\r\n\\#]/.test(decoded) ||
      decoded.split('/').some((part) => part === '.' || part === '..') ||
      !['GET', 'POST', 'PATCH', 'PUT'].includes(method)
    )
      throw new Error('Invalid GitHub request scope');
    const prefix = `/repos/${this.repository}`;
    const url = new URL('https://api.github.com' + prefix + path);
    if (
      url.origin !== 'https://api.github.com' ||
      (url.pathname !== prefix && !url.pathname.startsWith(prefix + '/'))
    )
      throw new Error('GitHub request escapes captured repository');
    return url.href;
  }

  /** Exhausts provider pagination for decisions that must not ignore later reviews or checks. */
  async pages(path: string, signal: AbortSignal, key?: string): Promise<any[]> {
    const items: any[] = [];
    for (let page = 1; ; page++) {
      const value = await this.request(
        `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`,
        signal,
      );
      const next = key ? value[key] : value;
      if (!Array.isArray(next)) throw new Error('Invalid GitHub listing response');
      items.push(...next);
      if (next.length < 100) return items;
    }
  }
}
