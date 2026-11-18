import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { codex } from '../../src/codex.js';

type Fixture = { root: string; executable: string; input: string; args: string; cwd: string };

/** Create the isolated fake Codex process used only for adapter transport. */
function fixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-harness-'));
  const input = join(root, 'stdin');
  const args = join(root, 'args');
  const cwd = join(root, 'cwd');
  const executable = join(root, 'codex-fixture');
  writeFileSync(executable, `#!/bin/sh
pwd > "${cwd}"
printf '%s\\n' "$@" > "${args}"
cat > "${input}"
printf '%s\\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}'
`);
  chmodSync(executable, 0o700);
  return { root, executable, input, args, cwd };
}

/** Invoke the adapter with one explicitly fabricated inspection request. */
async function observe(state: Fixture, prompt: string, options: Record<string, unknown>): Promise<void> {
  const view = { request: { input: prompt, options } } as unknown as AgentInspection;
  await codex(state.executable, view, join(state.root, 'codex.log'), AbortSignal.timeout(5_000), {
    url: 'http://127.0.0.1:1234/mcp',
  });
}

/** Assert the adapter preserves input bytes and effective Codex arguments. */
function assertObservation(state: Fixture, prompt: string, model: string): void {
  assert.equal(readFileSync(state.input, 'utf8'), prompt);
  assert.equal(readFileSync(state.cwd, 'utf8'), `${state.root}\\n`);
  const argv = readFileSync(state.args, 'utf8').trimEnd().split('\\n');
  assert.equal(argv[argv.indexOf('--model') + 1], model);
  assert.equal(argv[argv.indexOf('--cd') + 1], state.root);
  assert(argv.includes('model_reasoning_effort="high"'));
  assert(argv.includes('web_search="disabled"'));
  assert(argv.includes('mcp_servers={arcnexus={url="http://127.0.0.1:1234/mcp",required=true,default_tools_approval_mode="approve"}}'));
  assert(argv.includes('--ignore-user-config'));
  assert(!argv.includes('--no-project-doc'));
  assert(!argv.some((arg) => /^(?:project_doc_max_bytes|project_doc_fallback_filenames|features\\.skills)=/.test(arg)));
}

test('Codex harness forwards fabricated request bytes and retains native discovery settings', async (t) => {
  const state = fixture();
  t.after(() => rmSync(state.root, { recursive: true, force: true }));
  const prompt = 'Source: activity.yaml\\nSelected activity and supplied task\\n';
  const model = 'fixture-model';
  const options = {
    model,
    modelReasoningEffort: 'high',
    webSearchMode: 'disabled',
    workingDirectory: state.root,
    tools: [],
  };
  await observe(state, prompt, options);
  assertObservation(state, prompt, model);
});
