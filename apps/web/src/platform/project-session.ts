import { Subscriptions } from '../../../../packages/ui/src/index.js';

export interface Project {
  id: string;
  remote: string;
  name?: string;
  revision: string;
}

/** Own the active project for one platform composition. */
export class ProjectSession {
  private current: { project?: Project };
  private readonly updates = new Subscriptions();

  /** Start with a known project when supplied by a local preview. */
  constructor(project?: Project) {
    this.current = { project };
  }

  /** Expose a stable snapshot to React and gateway bindings. */
  readonly getSnapshot = () => this.current;

  /** Subscribe to changes under this composition's authority. */
  readonly subscribe = this.updates.subscribe;

  /** Change the project and notify this composition's consumers. */
  select(project?: Project) {
    this.current = { project };
    this.updates.publish();
  }
}
