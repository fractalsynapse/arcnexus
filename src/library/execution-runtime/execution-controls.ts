import { InputError } from '../architecture/config.js';
import { statePath } from '../workspace/state.js';
import { ExecutionResources } from './execution-resources.js';
import { RetainedHost } from './retained-host.js';

/** Applies identity-based task controls through the original host, independently of caller location. */
export class ExecutionControls {
  /** Resolves application storage without requiring a checkout or creating a new execution host. */
  constructor(private readonly root = statePath()) {}

  /** Sends one mutation; uncertain responses are surfaced rather than automatically replayed. */
  async task(action: string, id: string, answer?: string, expectedRevision?: string) {
    if (!['pause', 'resume', 'stop', 'answer'].includes(action))
      throw new InputError('Unknown task control: ' + action);
    if (action === 'answer' && !answer?.trim())
      throw new InputError('Task answer must not be empty');
    const resource = new ExecutionResources(this.root).get('task', id);
    if (expectedRevision !== undefined && resource.revision !== expectedRevision)
      throw new InputError('Stale task revision; read the task again');
    const connection = await new RetainedHost(this.root, resource.project).connect(
      (resource.run.data as Record<string, unknown>).executionIdentity,
    );
    return connection.request({
      action: 'task-control',
      control: action,
      id,
      answer,
      expectedRevision,
    });
  }
}
