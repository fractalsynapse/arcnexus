import { Subscriptions } from './subscriptions.js';
import type { ReactNode } from 'react';
import type { Workspace, DisplayRegistration, WorkspaceFeature } from './workspace.js';

/** Collect the workspace definitions contributed by trusted browser plugins. */
export class UiRegistry {
  private readonly entries = new Map<string, Omit<Workspace, 'displays'>>();
  private readonly displays = new Map<string, Map<string, DisplayRegistration>>();
  private readonly features = new Map<string, WorkspaceFeature>();
  private readonly subscriptions = new Subscriptions();
  private readonly controls = new Map<string, ReactNode>();
  private snapshot: readonly Workspace[] = [];
  private controlSnapshot: ReadonlyArray<readonly [string, ReactNode]> = [];
  private context: ReactNode;

  /** Add a global header control in plugin registration order until disposal. */
  registerHeaderControl(id: string, control: ReactNode) {
    if (this.controls.has(id)) throw new Error('Duplicate header control: ' + id);
    this.controls.set(id, control);
    this.publish();
    return () => {
      this.controls.delete(id);
      this.publish();
    };
  }

  /** Keep header contributions stable until the registry changes. */
  readonly headerControls = () => this.controlSnapshot;

  /** Set the context displayed alongside every workspace heading. */
  registerWorkspaceContext(content: ReactNode) {
    if (this.context !== undefined) throw new Error('Workspace context is already registered');
    this.context = content;
    this.publish();
    return () => {
      this.context = undefined;
      this.publish();
    };
  }

  /** Return the workspace context contributed to the frame. */
  readonly workspaceContext = () => this.context;

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

  /** Attach independently mounted feature content to a workspace's stable navigation route. */
  registerWorkspaceFeature(path: string, feature: WorkspaceFeature) {
    if (this.features.has(path)) throw new Error('Duplicate workspace feature: ' + path);
    this.features.set(path, feature);
    this.publish();
    return () => {
      this.features.delete(path);
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
  readonly subscribe = this.subscriptions.subscribe;

  /** Rebuild the renderable workspace registrations in navigation order. */
  private publish() {
    this.controlSnapshot = [...this.controls];
    this.snapshot = [...this.entries.values()].map((workspace) => ({
      ...workspace,
      ...this.features.get(workspace.path),
      displays: [...(this.displays.get(workspace.path)?.values() ?? [])],
    }));
    this.subscriptions.publish();
  }
}
