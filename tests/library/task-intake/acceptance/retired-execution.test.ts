import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeExecution } from '../../../../dist/library/task-intake/initializer.js';
import { registerSuite } from '../../../../dist/library/testing/suite.js';

/** Refuses obsolete intake authority before creating a child run or launching a check. */
class RetiredIntakeScenarios {
  /** Historical initializer components remain inspectable but cannot initialize a new session. */
  async owner(): Promise<void> {
    await this.reject({ context: [{ schemaVersion: 4 }] }, /version.five.*migrat/i);
  }

  /** Captured legacy deadlines require migration instead of arming a hidden timer. */
  async deadline(): Promise<void> {
    await this.reject(
      {
        context: [{ schemaVersion: 5 }],
        profile: { id: 'old', schemaVersion: 2, timeoutSeconds: 1 },
      },
      /obsolete work budget timeoutSeconds/,
    );
  }

  /** Intentionally omits filesystem inputs to prove the authority guard runs first. */
  private async reject(initialization: unknown, expected: RegExp): Promise<void> {
    await assert.rejects(initializeExecution({ resolved: { initialization } } as any), expected);
  }
}

const scenarios = new RetiredIntakeScenarios();

test('initializer rejects historical owner authority before creating evidence', () =>
  scenarios.owner());

test('initializer rejects historical execution deadlines before creating evidence', () =>
  scenarios.deadline());

registerSuite({ component: 'task-intake', level: 'acceptance', tags: ['deterministic'] });
