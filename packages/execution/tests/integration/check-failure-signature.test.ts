import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import * as execution from '../../src/index.js';
import { checkFailureSignature } from '../../src/steward-check.js';

export const suite = { owner: 'execution', level: 'integration', tags: ['regression'] } as const;

type Signature = (log: string) => string;

/** Exercise retained files without changing diagnostics or relying on a Workflow implementation. */
class SignatureScenario {
  private readonly directory = mkdtempSync(join(tmpdir(), 'check-signature-'));

  /** Isolate authored retained logs and remove them after all assertions finish. */
  constructor(
    t: TestContext,
    private readonly signature: Signature,
  ) {
    t.after(() => rmSync(this.directory, { recursive: true, force: true }));
  }

  /** Compare realistic TAP failures while varying numbering, workspaces and source locations. */
  equivalentFailures() {
    const first = this.log('original.log', tapFailure(4, '/state/runs/124/worktree', 18));
    const resumed = this.log('resumed.log', tapFailure(19, '/other/measure-worktree', 72));
    assert.equal(this.signature(first), this.signature(resumed));
    assert.notEqual(first, resumed);
    assert.equal(readFileSync(first, 'utf8'), tapFailure(4, '/state/runs/124/worktree', 18));
    const detail = tapFailure(19, '/other/measure-worktree', 72).replace(
      'expected complete retained answer',
      'expected secured edit receipt',
    );
    assert.notEqual(
      this.signature(first),
      this.signature(this.log('different-detail.log', detail)),
    );
  }

  /** Distinguish ordinary errors even when their check title and status stay unchanged. */
  differentFailures() {
    const first = this.log('missing-answer.log', 'Error: missing retained answer\n');
    const next = this.log('missing-receipt.log', 'Error: missing secured receipt\n');
    assert.notEqual(this.signature(first), this.signature(next));
    assert.equal(this.signature(first), digest('Error: missing retained answer'));
    const noisy = this.log('noise.log', 'new run preamble\nError: missing retained answer\nok 7\n');
    assert.equal(this.signature(first), this.signature(noisy));
    const compiler = this.log(
      'compiler.log',
      "/state/worktree/packages/sample/src/index.ts(18,4): error TS2322: Type 'number' is not assignable to type 'string'.\n",
    );
    const moved = this.log(
      'compiler-moved.log',
      "/other/measure-worktree/packages/sample/src/index.ts(72,9): error TS2322: Type 'number' is not assignable to type 'string'.\n",
    );
    assert.equal(this.signature(compiler), this.signature(moved));
  }

  /** Keep unclassified ordinary failure content instead of collapsing it to an empty signature. */
  fallbackContent() {
    const text = '  retained answer differs\nexpected: café complete\nactual: absent\n';
    const first = this.log('ordinary.log', text);
    const same = this.log('ordinary-copy.log', text);
    const changed = this.log('ordinary-changed.log', text.replace('absent', 'partial'));
    assert.equal(this.signature(first), digest(text.trim()));
    assert.equal(this.signature(first), this.signature(same));
    assert.notEqual(this.signature(first), this.signature(changed));
    assert.equal(readFileSync(first, 'utf8'), text);
  }

  /** Surface actual filesystem errors with their path rather than manufacturing a comparison value. */
  readFailures() {
    const missing = join(this.directory, 'unavailable.log');
    assert.throws(() => this.signature(missing), { code: 'ENOENT', path: missing });
    assert.throws(() => this.signature(this.directory), { code: 'EISDIR' });
    assert.throws(() => this.signature('Error: diagnostic text is not a log path'), {
      code: 'ENOENT',
      path: 'Error: diagnostic text is not a log path',
    });
  }

  /** Write each complete authored source once; comparisons must read this file rather than its name. */
  private log(name: string, content: string) {
    const path = join(this.directory, name);
    writeFileSync(path, content, { flag: 'wx' });
    return path;
  }
}

/** Supply ordinary retained TAP diagnostics with a multiline assertion block and transient stack. */
function tapFailure(number: number, root: string, line: number) {
  return [
    'TAP version 13',
    'ok 1 - setup',
    `not ok ${number} - preserves reviewed hold evidence`,
    '  ---',
    '  error: |-',
    '    expected complete retained answer',
    `    at ${root}/packages/sample/tests/recovery.test.ts:${line}:4`,
    `    artifact /tmp/recovery-${number}/answer.json`,
    '  ...',
    '1..20',
    '',
  ].join('\n');
}

/** Pin the documented digest contract without reproducing diagnostic selection or normalization. */
function digest(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

/** Run the same discriminating observations for the baseline and the consumer-facing export. */
function characterize(t: TestContext, signature: Signature) {
  const scenario = new SignatureScenario(t, signature);
  scenario.equivalentFailures();
  scenario.differentFailures();
  scenario.fallbackContent();
  scenario.readFailures();
}

// canonical-check-signature-public: Workflow's reviewed-hold consumer must resolve the
// same canonical function through Execution's entry; a copied comparator or wrapper fails identity.
// canonical-check-signature-evidence: actual retained-file comparisons reject raw path/text
// hashing, constant signatures, title-only comparisons, lost multiline detail and empty fallback.
// Exact digests pin SHA-256; read failures reject treating diagnostic text as file contents or
// swallowing unavailable evidence. Original log bytes remain readable after comparison.
// This passing baseline is characterization, not behavioral red for a missing export.
test('existing canonical retained-log semantics remain characterized independently of export availability', (t) => {
  characterize(t, checkFailureSignature);
});

// Namespace lookup keeps a missing export an explicit boundary assertion, not a compiler/import error.
test('Execution public entry exposes the existing canonical retained-log function and its semantics', (t) => {
  const signature: unknown = Reflect.get(execution, 'checkFailureSignature');
  assert.equal(
    typeof signature,
    'function',
    'Execution public entry is missing checkFailureSignature(log: string): string',
  );
  assert.equal(signature, checkFailureSignature, 'reuse the canonical function without a wrapper');
  characterize(t, signature as Signature);
});
