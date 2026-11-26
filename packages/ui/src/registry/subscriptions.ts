/** Notify observers of a browser state change and dispose their subscriptions. */
export class Subscriptions {
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Notify every mounted observer after its source commits a new snapshot. */
  publish() {
    for (const listener of this.listeners) listener();
  }
}
