import { readFileSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { InputError } from '../architecture/config.js';
import { DeliveryResources } from '../publisher/publisher.js';
import { stagingContext } from './staging-context.js';
import { HostClient } from './host-client.js';

/** Starts promotion under newly captured target authority instead of upgrading the simulation's supervisor. */
export class PromotionControl {
  /** Uses the configured volume to resolve delivery and repository identities independently of the terminal. */
  constructor(private readonly root: string) {}

  /** Validates the observed delivery, resolves its real source and queues one new live promotion task. */
  async request(id: string, expectedRevision?: string) {
    const delivery = new DeliveryResources(this.root).get(id);
    if (expectedRevision !== undefined && expectedRevision !== delivery.revision)
      throw new InputError('Stale simulation delivery revision');
    if (delivery.environment.mode !== 'simulation')
      throw new InputError('Only a simulation delivery can be promoted');
    const { repository, branch } = delivery.target;
    const source = this.source(delivery.projectId);
    const target = await stagingContext(
      source,
      delivery.packageId,
      join(this.root, 'projects', delivery.projectId),
      repository,
      branch,
      new AbortController().signal,
    );
    const client = new HostClient(source, this.root, {
      packageId: target.packageId,
      base: target.base,
    });
    if (client.context.key !== delivery.projectId)
      throw new InputError('Promotion repository identity changed');
    await client.ensure('delivery-promote');
    const identity = await client.request({ action: 'identity' });
    if (!identity.hostCapabilities?.includes('delivery-promote'))
      throw new InputError('Current host does not support promotion; finish retained work first');
    return client.request({ action: 'delivery-promote', id, expectedRevision: delivery.revision });
  }

  /** Resolves retained source location without reusing its old configuration or allowing path aliases. */
  private source(projectId: string): string {
    const directory = join(realpathSync(this.root), 'projects', projectId);
    const path = join(directory, 'host.json');
    if (realpathSync(path) !== path) throw new InputError('Unsafe retained host metadata');
    const metadata = JSON.parse(readFileSync(path, 'utf8'));
    if (
      typeof metadata.contextFile !== 'string' ||
      basename(metadata.contextFile) !== metadata.contextFile
    )
      throw new InputError('Invalid retained source context');
    const contextPath = join(directory, metadata.contextFile);
    if (realpathSync(contextPath) !== contextPath) throw new InputError('Unsafe retained context');
    const context = JSON.parse(readFileSync(contextPath, 'utf8'));
    if (context.key !== projectId || typeof context.source !== 'string')
      throw new InputError('Retained source identity mismatch');
    return context.source;
  }
}
