import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { DeliveryRecord } from '../coordination-store/delivery-types.js';
import type { LifecycleStore } from '../coordination-store/lifecycle-store.js';
import type { ExternalEffect, ExternalObservation } from '../coordination-store/lifecycle-types.js';
import type { CheckResult } from './check-result.js';
import type { EvidenceChangeRecord } from './evidence-change-record.js';

/**
 * Records the release a simulated namespace intends, over its real captured artifacts.
 *
 * The effect journal is the record: what was proven, over which merged head, with which
 * content-addressed build outputs. Nothing here claims a registry, a tag or a remote state. An
 * interrupted retry that already captured bytes yields the same identity rather than a second one,
 * so no separate receipt table is needed to prove it happened once.
 */
export class EvidenceRelease {
  /** Binds release scope and private artifact storage to one immutable verified delivery. */
  constructor(
    private readonly delivery: DeliveryRecord,
    private readonly change: EvidenceChangeRecord,
    private readonly effects: LifecycleStore,
    private readonly artifactRoot: string,
  ) {
    this.delivery = structuredClone(delivery);
    if (delivery.environment.mode !== 'simulation') throw new Error('Expected simulated release');
    this.assertPath(resolve(artifactRoot), true);
    mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
  }

  /** Requires a merged, independently verified delivery and its actual build outputs. */
  async apply(effect: ExternalEffect, signal: AbortSignal): Promise<Record<string, unknown>> {
    signal.throwIfAborted();
    this.assert(effect);
    const verification = this.mergeVerification();
    const state = this.change.state();
    if (
      !state.merged ||
      verification?.status !== 'passed' ||
      !verification.evidence.length ||
      !verification.artifacts.length
    )
      throw new Error('Release requires merged verification and actual captured build artifacts');
    const artifacts = verification.artifacts.map((artifact) => this.capture(artifact));
    signal.throwIfAborted();
    return {
      id: `${this.delivery.environment.id}:release:${this.delivery.id}`,
      deliveryId: this.delivery.id,
      environmentId: this.delivery.environment.id,
      head: state.mergeHead,
      artifacts,
      simulation: true,
    };
  }

  /** A release is a local computation, so an uncertain one has nothing external to reconcile. */
  inspect(effect: ExternalEffect): ExternalObservation {
    this.assert(effect);
    return { status: 'absent', evidence: 'local-computation:release.create' };
  }

  /** The independent verification that justified the merge, read from the merge effect itself. */
  private mergeVerification(): CheckResult | undefined {
    const merged = this.effects
      .effects()
      .find(
        (effect) =>
          effect.status === 'completed' &&
          effect.operation === 'pull-request.merge' &&
          String(effect.input.deliveryId ?? '') === this.delivery.id,
      );
    return merged?.result?.verification as CheckResult | undefined;
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
