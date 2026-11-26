import { useEffect, useRef, useState } from 'react';
import { useBrowserPlatform } from './browser-platform.js';
import type { GatewayClient } from './gateway-client.js';

type Resource<T> = { path?: string; value?: T; error?: string };

/** Fetch only while a visible consumer holds this project-scoped resource. */
export function useResource<T>(path: string | undefined, refresh?: unknown, identity?: string) {
  const { gateway } = useBrowserPlatform();
  const [state, setState] = useState<Resource<T>>({});
  const reader = useRef<ResourceReader<T> | undefined>(undefined);
  const key = path && (identity ? JSON.stringify([path, identity]) : path);
  useEffect(() => {
    if (!path || !key) return;
    const observe = new ResourceReader<T>(gateway, path, key, setState);
    reader.current = observe;
    return () => {
      reader.current = undefined;
      observe.close();
    };
  }, [gateway, path, key]);
  useEffect(() => reader.current?.reload(), [gateway, key, refresh]);
  return state.path === key ? state : {};
}

/** Coalesce notices during a read and fetch again afterwards so bursts cannot starve updates. */
class ResourceReader<T> {
  private pending?: ReturnType<GatewayClient['share']>;
  private dirty = false;
  private closed = false;

  /** Publish only snapshots for the path this consumer mounted. */
  constructor(
    private readonly gateway: GatewayClient,
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
    const read = this.gateway.share(this.path, this.key);
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
