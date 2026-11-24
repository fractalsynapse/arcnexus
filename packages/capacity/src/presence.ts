/** Represent live authenticated connections independently of durable enrollment state. */
export class Presence {
  private readonly connections = new Map<string, AbortController>();

  /** Report whether an authenticated connection is present. */
  online(id: string) {
    return this.connections.has(id);
  }

  /** Replace a prior connection and bind cleanup to this connection only. */
  attach(id: string) {
    this.disconnect(id);
    const lifetime = new AbortController();
    this.connections.set(id, lifetime);
    return {
      signal: lifetime.signal,
      close: () => {
        if (this.connections.get(id) === lifetime) this.disconnect(id);
      },
    };
  }

  /** Unregister the provider and end its active stream. */
  disconnect(id: string) {
    const lifetime = this.connections.get(id);
    this.connections.delete(id);
    lifetime?.abort();
  }
}
