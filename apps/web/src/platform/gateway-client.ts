export type GatewayTransport = (path: string, request: RequestInit) => Promise<Response>;

type Pending = { controller: AbortController; value: Promise<unknown>; users: number };

/** Preserve HTTP status for callers that can recover from a refused request. */
export class GatewayFailure extends Error {
  /** Keep the gateway status and optionally an actionable input validation message. */
  constructor(
    readonly status: number,
    message?: string,
  ) {
    super(message ?? 'Gateway request failed (' + status + ')');
  }
}

async function rejection(response: Response) {
  if (response.status !== 422) return new GatewayFailure(response.status);
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  return new GatewayFailure(
    response.status,
    typeof body?.error === 'string' ? body.error : undefined,
  );
}

/** Own the transport and shared in-flight reads for one browser composition. */
export class GatewayClient {
  private readonly reads = new Map<string, Pending>();

  /** Take a scoped transport so the fixture and live gateway use the same client. */
  constructor(private readonly transport: GatewayTransport) {}

  /** Apply the common gateway request and error handling. */
  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await this.transport(path, { ...init, headers, redirect: 'error' });
    if (!response.ok) throw await rejection(response);
    return response;
  }

  /** Decode an independent scoped JSON resource. */
  async read<T>(path: string, init?: RequestInit) {
    return (await (await this.request(path, init)).json()) as T;
  }

  /** Keep a request alive until its last mounted consumer releases it. */
  share(path: string, key: string) {
    const request = this.reads.get(key) ?? this.start(path, key);
    request.users += 1;
    return {
      value: request.value,
      release: () => {
        request.users -= 1;
        if (request.users) return;
        if (this.reads.get(key) === request) this.reads.delete(key);
        request.controller.abort();
      },
    };
  }

  /** Drop a completed read so the next notice can request fresh data. */
  private start(path: string, key: string) {
    const controller = new AbortController();
    const value = this.read(path, { signal: controller.signal });
    const request = { controller, value, users: 0 };
    this.reads.set(key, request);
    const complete = () => {
      if (this.reads.get(key) === request) this.reads.delete(key);
    };
    void value.then(complete, complete);
    return request;
  }
}
