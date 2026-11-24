import type { Workspace, DisplayRegistration } from './workspace.js';

/** Collect the workspace definitions contributed by trusted browser plugins. */
export class UiRegistry {
  private readonly entries = new Map<string, Omit<Workspace, 'displays'>>();
  private readonly displays = new Map<string, Map<string, DisplayRegistration>>();
  private readonly listeners = new Set<() => void>();
  private snapshot: readonly Workspace[] = [];

  /** Register one workspace and remove it when its owning plugin is disposed. */
  register(workspace: Omit<Workspace, 'displays'>) {
    if (this.entries.has(workspace.path))
      throw new Error('Duplicate workspace path: ' + workspace.path);
    this.entries.set(workspace.path, workspace);
    this.publish();
    return () => {
      this.entries.delete(workspace.path);
      this.publish();
    };
  }

  /** Contribute an eligible display without changing another plugin's workspace definition. */
  registerDisplay(path: string, display: DisplayRegistration) {
    const entries = this.displays.get(path) ?? new Map<string, DisplayRegistration>();
    if (entries.has(display.id))
      throw new Error('Duplicate display ' + display.id + ' for ' + path);
    entries.set(display.id, display);
    this.displays.set(path, entries);
    this.publish();
    return () => {
      entries.delete(display.id);
      if (!entries.size) this.displays.delete(path);
      this.publish();
    };
  }

  /** Return a stable snapshot until a registration changes. */
  readonly workspaces = () => this.snapshot;

  /** Notify mounted frames about contributions and plugin disposal. */
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Rebuild the renderable workspace registrations in navigation order. */
  private publish() {
    this.snapshot = [...this.entries.values()].map((workspace) => ({
      ...workspace,
      displays: [...(this.displays.get(workspace.path)?.values() ?? [])],
    }));
    for (const listener of this.listeners) listener();
  }
}
