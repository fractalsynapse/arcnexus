import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentInspection } from '../../architecture/src/index.js';
import { execute } from './process.js';

/** Distinguish an unreadable actor answer from a failed harness process. */
export class InvalidCodexResponse extends Error {}

/** Activate the installed Codex binding with the exact prepared prompt and isolated tools. */
export async function codex(
  executable: string,
  view: AgentInspection,
  log: string,
  signal: AbortSignal,
): Promise<unknown> {
  const { input, options } = view.request;
  const cwd = options.workingDirectory;
  const params = invocation(executable, cwd, log, options);
  const result = await execute(executable, params, {
    cwd,
    signal,
    log,
    input,
    env: {
      PATH: '/usr/bin:/bin',
      HOME: homedir(),
      CODEX_HOME: process.env.CODEX_HOME ?? join(homedir(), '.codex'),
      LANG: 'C.UTF-8',
    },
  });
  if (result.status !== 0)
    throw new Error(`Codex activation failed (${result.status}); evidence: ${log}`);
  return answer(result.stdout, log);
}

/** Start a fresh noninteractive activation without loading personal executable configuration. */
function invocation(
  executable: string,
  cwd: string,
  log: string,
  options: AgentInspection['request']['options'],
) {
  return [
    'exec',
    '--ignore-user-config',
    '--ignore-rules',
    '--ephemeral',
    '--json',
    '--color',
    'never',
    '--cd',
    cwd,
    '--model',
    options.model,
    ...settings(executable, cwd, log, options),
    '-',
  ];
}

/** Restrict Codex shell access to project reads and disable out-of-bound integrations. */
function settings(
  executable: string,
  cwd: string,
  log: string,
  options: AgentInspection['request']['options'],
) {
  const config = [
    'approval_policy="never"',
    'default_permissions="arcnexus"',
    `permissions.arcnexus.filesystem={":minimal"="read","/sys/fs/cgroup"="read",${JSON.stringify(executable)}="read",${JSON.stringify(cwd)}="read",${JSON.stringify(log.slice(0, log.lastIndexOf('/')))}="read"}`,
    'permissions.arcnexus.network.enabled=false',
    'features.plugins=false',
    'features.apps=false',
    'features.hooks=false',
    'features.multi_agent=false',
    `model_reasoning_effort=${JSON.stringify(options.modelReasoningEffort)}`,
    `web_search=${JSON.stringify(options.webSearchMode)}`,
  ];
  return config.flatMap((entry) => ['-c', entry]);
}

/** Decode the final structured response while keeping the original stream in evidence. */
function answer(stdout: string, log: string): unknown {
  let message: string | undefined;
  for (const line of stdout.trim().split('\n')) {
    const event = JSON.parse(line);
    if (event.type === 'item.completed' && event.item?.type === 'agent_message')
      message = event.item.text;
  }
  if (!message)
    throw new InvalidCodexResponse(`Codex returned no final response; evidence: ${log}`);
  try {
    return JSON.parse(message);
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    throw new InvalidCodexResponse(
      `Codex returned an invalid task response: ${diagnostic}; evidence: ${log}`,
    );
  }
}
