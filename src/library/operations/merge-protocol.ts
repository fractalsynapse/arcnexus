import type { CheckResult } from '../operations/check-result.js';
import type { ExternalEffect } from '../coordination-store/lifecycle-types.js';

/**
 * What a provider must expose for the one merge protocol to run against it.
 *
 * `gates`, `assemble` and `integrate` are required: they are the parts that differ between a real
 * remote and a captured namespace. The optional hooks exist for providers that journal their own
 * state around an integration so an interrupted merge can be reconciled; a provider with an
 * external source of truth simply omits them.
 */
export interface MergeAdapter {
  /** Observes the requirements for the target head; throws when the provider blocks integration. */
  gates(effect: ExternalEffect, signal: AbortSignal): Promise<{ base: string }>;

  /** Builds the merge commit that would result, without moving anything. */
  assemble(effect: ExternalEffect, signal: AbortSignal): Promise<string>;

  /** Moves the target only while the caller's compare-and-swap expectation still holds. */
  integrate(
    effect: ExternalEffect,
    assembled: string,
    signal: AbortSignal,
  ): Promise<Record<string, unknown>>;

  /** Journals that integration began, before anything is built. */
  began?(effect: ExternalEffect): void | Promise<void>;

  /** Journals the verified assembled tree, after the pass and before the target moves. */
  progressed?(effect: ExternalEffect, assembled: string, verification: CheckResult): void;

  /**
   * Records that integration was refused for this assembled tree.
   *
   * A provider that tracks the refusal returns the receipt describing it, so the caller still sees
   * a completed effect carrying `merged: false` and its reason rather than a transport failure.
   */
  refused?(
    effect: ExternalEffect,
    assembled: string,
    verification: CheckResult,
  ): Record<string, unknown> | void;
}

/**
 * Integrates an assembled delivery — the single protocol every environment shares.
 *
 * The ordering *is* the safety property, so it lives in one place: observe the requirements, build
 * the merge commit without moving the target, verify the **assembled** tree independently because a
 * merge commit is different bytes from the candidate the assembly gate checked, require a pass
 * backed by evidence, re-observe the target in case it moved during that verification, re-assert
 * authorization, then compare-and-swap. A failed assembly check records the refusal and moves
 * nothing.
 */
/** The assembled tree and its verification, or the refusal that stopped integration. */
interface Assembled {
  assembled: string;
  verification: CheckResult;
  refusal?: Record<string, unknown>;
}

/**
 * Builds the merge commit and verifies exactly those bytes.
 *
 * This is the step that separates an honest gate from a stale one: the candidate the assembly gate
 * checked and the merge commit about to land are different trees, so the assembled tree is checked
 * independently before anything is allowed to move.
 */
async function verifyAssembled(
  adapter: MergeAdapter,
  effect: ExternalEffect,
  checks: (head: string, signal: AbortSignal, independent: boolean) => Promise<CheckResult>,
  signal: AbortSignal,
): Promise<Assembled> {
  const assembled = await adapter.assemble(effect, signal);
  const verification = await checks(assembled, signal, true);
  signal.throwIfAborted();
  if (!verification.evidence.length)
    throw new Error('Assembled merge has no verification evidence');
  if (verification.status !== 'passed')
    return {
      assembled,
      verification,
      refusal:
        adapter.refused?.(effect, assembled, verification) ??
        ({ merged: false, reason: 'Assembled delivery verification failed' } as Record<
          string,
          unknown
        >),
    };
  adapter.progressed?.(effect, assembled, verification);
  return { assembled, verification };
}

/**
 * Integrates an assembled delivery — the single protocol every environment shares.
 *
 * The ordering *is* the safety property, so it lives in one place: observe the requirements, build
 * the merge commit without moving the target, verify the assembled tree independently because a
 * merge commit is different bytes from the candidate the assembly gate checked, require a pass
 * backed by evidence, re-observe the target in case it moved while that verification ran, re-assert
 * authorization, then compare-and-swap. A failed assembly check records the refusal and moves
 * nothing.
 */
export async function integrateAssembled(
  adapter: MergeAdapter,
  effect: ExternalEffect,
  checks: (head: string, signal: AbortSignal, independent: boolean) => Promise<CheckResult>,
  authorize: () => void,
  signal: AbortSignal,
): Promise<Record<string, unknown>> {
  const expected = (await adapter.gates(effect, signal)).base;
  if (expected !== effect.input.targetHead)
    throw new Error('Publication target changed before assembly: ' + expected);
  await adapter.began?.(effect);
  const outcome = await verifyAssembled(adapter, effect, checks, signal);
  if (outcome.refusal) return outcome.refusal;
  const observed = await adapter.gates(effect, signal);
  if (observed.base !== effect.input.targetHead)
    throw new Error('Publication target changed during verification: ' + observed.base);
  authorize();
  const result = await adapter.integrate(effect, outcome.assembled, signal);
  return { ...result, verification: outcome.verification };
}
