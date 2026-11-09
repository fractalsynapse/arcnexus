import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import { ProviderStore } from '../coordination-store/provider-store.js';
import type { CheckResult } from './check-result.js';

/** Publishes actual checked artifacts into an isolated release store without contacting a package registry. */
export class SimulatedReleases {
  /** Binds release scope and private artifact storage to the host's immutable verified delivery. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly store: ProviderStore,
    private readonly artifactRoot: string,
  ) {
    this.delivery = structuredClone(delivery);
    if (delivery.environment.mode !== 'simulation') throw new Error('Expected simulated release');
    this.assertPath(resolve(artifactRoot), true);
    mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
  }

  /** Requires merged independent checks and copies their actual immutable outputs before committing a receipt. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    this.assert(effect);
    const prior = this.store.inspect(effect);
    if (prior.status === 'completed') return prior.result;
    const pr = this.store.resource(`${this.delivery.environment.id}:pr:${this.delivery.id}`);
    const checks = pr.data.mergeChecks as CheckResult | undefined;
    if (
      pr.data.state !== 'merged' ||
      checks?.status !== 'passed' ||
      !checks.evidence.length ||
      !checks.artifacts.length ||
      typeof pr.data.mergeHead !== 'string'
    )
      throw new Error('Release requires merged verification and actual captured build artifacts');
    const artifacts = checks.artifacts.map((artifact) => this.capture(artifact));
    signal.throwIfAborted();
    return this.store.apply(effect, () => this.release(pr.data.mergeHead as string, artifacts));
  }

  /** Reconciles the durable release receipt; partial artifact copies alone never prove publication. */
  inspect(effect: ExternalEffect): ExternalObservation {
    this.assert(effect);
    return this.store.inspect(effect);
  }

  /** Stores explicitly simulated release provenance separately from integration and engineering state. */
  private release(head: string, artifacts: CheckResult['artifacts']) {
    const id = `${this.delivery.environment.id}:release:${this.delivery.id}`;
    const result = {
      id,
      deliveryId: this.delivery.id,
      environmentId: this.delivery.environment.id,
      head,
      artifacts,
      simulation: true,
    };
    const prior = this.store.resources().find((resource) => resource.id === id);
    if (prior) {
      if (JSON.stringify(prior.data) !== JSON.stringify(result))
        throw new Error('Simulated release attribution conflict');
      return prior.data;
    }
    this.store.create({ id, kind: 'release', revision: 1, data: result });
    return result;
  }

  /** Checks captured artifact bytes and preserves content-addressed copies across interrupted retries. */
  private capture(artifact: { path: string; sha256: string }) {
    if (!/^[a-f0-9]{64}$/.test(artifact.sha256)) throw new Error('Invalid artifact digest');
    this.assertPath(resolve(artifact.path));
    const bytes = readFileSync(artifact.path);
    if (createHash('sha256').update(bytes).digest('hex') !== artifact.sha256)
      throw new Error('Captured release artifact changed');
    const path = join(this.artifactRoot, artifact.sha256);
    this.assertPath(resolve(path), true);
    if (existsSync(path)) {
      if (!readFileSync(path).equals(bytes)) throw new Error('Retained release artifact corrupted');
    } else writeFileSync(path, bytes, { flag: 'wx', mode: 0o400 });
    return { path, sha256: artifact.sha256 };
  }

  /** Rejects aliasing of both captured input and private output before reading or writing release bytes. */
  private assertPath(path: string, missing = false): void {
    let current = path;
    while (true) {
      try {
        const stat = lstatSync(current);
        if (stat.isSymbolicLink() || (stat.isFile() && stat.nlink !== 1))
          throw new Error('Unsafe release artifact alias');
        if (current === path && !missing && !stat.isFile())
          throw new Error('Release artifact is not a regular file');
      } catch (error) {
        if (!missing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      if (current === dirname(current)) break;
      current = dirname(current);
    }
  }

  /** Prevents callers from changing release identity, target, files or environment through effect input. */
  private assert(effect: ExternalEffect): void {
    if (
      effect.operation !== 'release.create' ||
      effect.environmentId !== this.delivery.environment.id ||
      effect.runId !== this.delivery.runId ||
      effect.target !== this.delivery.target.repository ||
      JSON.stringify(effect.input) !== JSON.stringify({ deliveryId: this.delivery.id })
    )
      throw new Error('Release intent is outside captured delivery authority');
  }
}
