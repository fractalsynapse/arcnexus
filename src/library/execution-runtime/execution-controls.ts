import { DeliveryResources } from '../publisher/publisher.js';
import { InputError } from '../architecture/config.js';
import { statePath } from '../workspace/state.js';
import { ExecutionResources } from './execution-resources.js';
import { RetainedHost } from './retained-host.js';

/** Applies identity-based task controls through the original host, independently of caller location. */
export class ExecutionControls {
  /** Resolves application storage without requiring a checkout or creating a new execution host. */
  constructor(private readonly root = statePath()) {}

  /** Applies workday controls to a resolved identity, preserving historical terminal runs. */
  async workday(action: string, id?: string, expectedRevision?: string, signal?: AbortSignal) {
    if (!['pause', 'resume', 'stop'].includes(action))
      throw new InputError('Unknown workday control: ' + action);
    const resource = new ExecutionResources(this.root).workday(id);
    if (expectedRevision !== undefined && resource.revision !== expectedRevision)
      throw new InputError('Stale workday revision; read the workday again');
    if (resource.workday.status === 'stopped') {
      if (action === 'resume') throw new InputError('Stopped workday cannot resume');
      return resource;
    }
    const connection = await new RetainedHost(this.root, resource.project).connect(
      (resource.workday.data as Record<string, unknown>).executionIdentity,
      'workday-control',
      signal,
    );
    await connection.request({
      action: 'workday-control',
      control: action,
      id: resource.workday.id,
      expectedRevision,
    });
    return new ExecutionResources(this.root).workday(resource.workday.id);
  }

  /** Requests publication from the original supervising runtime, preserving its repository lock and authority. */
  async delivery(id: string, expectedRevision?: string, signal?: AbortSignal) {
    const delivery = new DeliveryResources(this.root).get(id);
    if (expectedRevision !== undefined && delivery.revision !== expectedRevision)
      throw new InputError('Stale delivery revision');
    const connection = await new RetainedHost(this.root, delivery.projectId).connect(
      delivery.authorityDigest,
      'delivery-control',
      signal,
    );
    return connection.request({ action: 'delivery-control', id, expectedRevision });
  }

  /** Sends one mutation; uncertain responses are surfaced rather than automatically replayed. */
  async task(
    action: string,
    id: string,
    answer?: string,
    expectedRevision?: string,
    signal?: AbortSignal,
  ) {
    if (!['pause', 'resume', 'stop', 'answer'].includes(action))
      throw new InputError('Unknown task control: ' + action);
    if (action === 'answer' && !answer?.trim())
      throw new InputError('Task answer must not be empty');
    const resource = new ExecutionResources(this.root).get('task', id);
    if (expectedRevision !== undefined && resource.revision !== expectedRevision)
      throw new InputError('Stale task revision; read the task again');
    const connection = await new RetainedHost(this.root, resource.project).connect(
      (resource.run.data as Record<string, unknown>).executionIdentity,
      'task-control',
      signal,
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
