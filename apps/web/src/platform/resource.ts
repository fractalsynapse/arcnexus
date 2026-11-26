import { useEffect, useRef, useState } from 'react';

type Resource<T> = { path?: string; value?: T; error?: string };

type Fetch = (path: string, request: RequestInit) => Promise<Response>;
let transport: Fetch = (path, request) => fetch('/api' + path, request);

export function setPlatformTransport(fetch: Fetch) {
  transport = fetch;
}

/** Carry the gateway status without storing a response body. */
export class GatewayFailure extends Error {
  /** The status lets callers distinguish missing authority from a disconnected resource. */
  constructor(readonly status: number) {
    super('Gateway request failed (' + status + ')');
  }
}

export async function gatewayRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await transport(path, { ...init, headers, redirect: 'error' });
  if (!response.ok) throw new GatewayFailure(response.status);
  return response;
}

export async function api<T>(path: string, init: RequestInit = {}) {
  return (await (await gatewayRequest(path, init)).json()) as T;
}

type Pending = { controller: AbortController; value: Promise<unknown>; users: number };
const reads = new Map<string, Pending>();

function sharedRead(path: string, key: string) {
  let pending = reads.get(key);
  if (!pending) {
    const controller = new AbortController();
    pending = { controller, value: api(path, { signal: controller.signal }), users: 0 };
    reads.set(key, pending);
    const complete = () => {
      if (reads.get(key) === pending) reads.delete(key);
    };
    void pending.value.then(complete, complete);
  }
  const request = pending;
  request.users += 1;
  return {
    value: request.value,
    release() {
      request.users -= 1;
      if (request.users) return;
      if (reads.get(key) === request) reads.delete(key);
      request.controller.abort();
    },
  };
}

/** Fetch only while a visible consumer holds this project-scoped resource. */
export function useResource<T>(path: string | undefined, refresh?: unknown, identity?: string) {
  const [state, setState] = useState<Resource<T>>({});
  const reader = useRef<ResourceReader<T> | undefined>(undefined);
  const key = path && (identity ? JSON.stringify([path, identity]) : path);
  useEffect(() => {
    if (!path || !key) return;
    const observe = new ResourceReader<T>(path, key, setState);
    reader.current = observe;
    return () => {
      reader.current = undefined;
      observe.close();
    };
  }, [path, key]);
  useEffect(() => reader.current?.reload(), [key, refresh]);
  return state.path === key ? state : {};
}

/** Coalesce notices during a read and fetch again afterwards so bursts cannot starve updates. */
class ResourceReader<T> {
  private pending?: ReturnType<typeof sharedRead>;
  private dirty = false;
  private closed = false;

  /** Publish only snapshots for the path this consumer mounted. */
  constructor(
    private readonly path: string,
    private readonly key: string,
    private readonly publish: (state: Resource<T>) => void,
  ) {}

  /** Keep the in-flight request and remember whether it needs one trailing refresh. */
  reload() {
    if (this.pending) {
      this.dirty = true;
      return;
    }
    const read = sharedRead(this.path, this.key);
    this.pending = read;
    this.dirty = false;
    void read.value.then(
      (value) => this.complete({ path: this.key, value: value as T }),
      (error: Error) => this.complete({ path: this.key, error: error.message }),
    );
  }

  /** Release this consumer only, cancelling the shared request when it was the last. */
  close() {
    this.closed = true;
    this.pending?.release();
  }

  /** Publish the returned snapshot before issuing any queued read. */
  private complete(state: Resource<T>) {
    if (this.closed) return;
    this.pending?.release();
    this.pending = undefined;
    this.publish(state);
    if (this.dirty) this.reload();
  }
}
