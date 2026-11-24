import { useEffect, useState } from 'react';

type Resource<T> = { path?: string; token?: string; value?: T; error?: string };

type Fetch = (path: string, request: RequestInit) => Promise<Response>;
let transport: Fetch = (path, request) => fetch('/api' + path, request);

export function setPlatformTransport(fetch: Fetch) {
  transport = fetch;
}

export async function gatewayRequest(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', 'Bearer ' + token);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await transport(path, { ...init, headers, redirect: 'error' });
  if (!response.ok) throw new Error('Gateway request failed (' + response.status + ')');
  return response;
}

export async function api<T>(path: string, token: string, init: RequestInit = {}) {
  return (await (await gatewayRequest(path, token, init)).json()) as T;
}

type Pending = { controller: AbortController; value: Promise<unknown>; users: number };
const reads = new Map<string, Pending>();

function sharedRead(path: string, token: string) {
  const key = JSON.stringify([path, token]);
  let pending = reads.get(key);
  if (!pending) {
    const controller = new AbortController();
    pending = { controller, value: api(path, token, { signal: controller.signal }), users: 0 };
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
export function useResource<T>(path: string | undefined, token: string | undefined, refresh = 0) {
  const [state, setState] = useState<Resource<T>>({});
  useEffect(() => {
    if (!path || !token) return;
    let mounted = true;
    const read = sharedRead(path, token);
    void read.value.then(
      (value) => {
        if (mounted) setState({ path, token, value: value as T });
      },
      (error: Error) => {
        if (mounted) setState({ path, token, error: error.message });
      },
    );
    return () => {
      mounted = false;
      read.release();
    };
  }, [path, token, refresh]);
  return state.path === path && state.token === token ? state : {};
}
