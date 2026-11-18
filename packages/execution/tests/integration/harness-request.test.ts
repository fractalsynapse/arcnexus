import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { codex } from '../../src/codex.js';

test('Codex harness forwards request bytes and retains native guidance discovery settings', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-harness-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const executable = join(root, 'codex-fixture');
  const input = join(root, 'stdin');
  const args = join(root, 'args');
  const cwd = join(root, 'cwd');
  writeFileSync(
    executable,
    `#!/bin/sh
pwd > "${cwd}"
printf '%s\n' "$@" > "${args}"
cat > "${input}"
printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"{}"}}'
`,
  );
  chmodSync(executable, 0o700);
  const prompt = 'Source: activity.yaml\nSelected activity and supplied task\n';
  const options = {
    model: 'fixture-model',
    modelReasoningEffort: 'high',
    webSearchMode: 'disabled',
    workingDirectory: root,
    tools: [],
  };
  const view = { request: { input: prompt, options } } as unknown as AgentInspection;
  await codex(executable, view, join(root, 'codex.log'), AbortSignal.timeout(5_000), {
    url: 'http://127.0.0.1:1234/mcp',
  });
  assert.equal(readFileSync(input, 'utf8'), prompt);
  const argv = readFileSync(args, 'utf8').trimEnd().split('\n');
  assert.equal(argv[argv.indexOf('--model') + 1], options.model);
  assert.equal(argv[argv.indexOf('--cd') + 1], root);
  assert(argv.includes('model_reasoning_effort="high"'));
  assert(argv.includes('web_search="disabled"'));
  assert(
    argv.includes(
      'mcp_servers={arcnexus={url="http://127.0.0.1:1234/mcp",required=true,default_tools_approval_mode="approve"}}',
    ),
  );
  assert(argv.includes('--ignore-user-config'));
  assert(!argv.includes('--no-project-doc'));
  assert(
    !argv.some((arg) =>
      /^(?:project_doc_max_bytes|project_doc_fallback_filenames|features\.skills)=/.test(arg),
    ),
  );
});
