import { useEffect, useState } from 'react';

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

function sharedRead(path: string) {
  let pending = reads.get(path);
  if (!pending) {
    const controller = new AbortController();
    pending = { controller, value: api(path, { signal: controller.signal }), users: 0 };
    reads.set(path, pending);
    const complete = () => {
      if (reads.get(path) === pending) reads.delete(path);
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
      if (reads.get(path) === request) reads.delete(path);
      request.controller.abort();
    },
  };
}

/** Fetch only while a visible consumer holds this project-scoped resource. */
export function useResource<T>(path: string | undefined, refresh?: unknown) {
  const [state, setState] = useState<Resource<T>>({});
  useEffect(() => {
    if (!path) return;
    let mounted = true;
    const read = sharedRead(path);
    void read.value.then(
      (value) => {
        if (mounted) setState({ path, value: value as T });
      },
      (error: Error) => {
        if (mounted) setState({ path, error: error.message });
      },
    );
    return () => {
      mounted = false;
      read.release();
    };
  }, [path, refresh]);
  return state.path === path ? state : {};
}
