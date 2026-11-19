import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentInspection } from '../../architecture/src/index.js';
import { execute } from './process.js';
import { InvalidAgentResponse } from '../../agent/src/index.js';

/** Distinguish an unreadable actor answer from a failed harness process. */
export class InvalidCodexResponse extends InvalidAgentResponse {}

interface NativeTools {
  schema?: string;
  url: string;
}

const unusedFeatures = [
  'apps',
  'browser_use',
  'browser_use_external',
  'hooks',
  'image_generation',
  'in_app_browser',
  'multi_agent',
  'plugins',
  'shell_snapshot',
  'shell_tool',
  'skill_mcp_dependency_install',
  'skill_search',
  'unified_exec',
  'view_image',
];

/** Activate the installed Codex binding with the exact prepared prompt and isolated tools. */
export async function codex(
  executable: string,
  view: AgentInspection,
  log: string,
  signal: AbortSignal,
  tools: NativeTools,
): Promise<unknown> {
  const { input, options } = view.request;
  const cwd = options.workingDirectory;
  const params = invocation(executable, cwd, log, options, tools);
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
  return decodeCodexAnswer(result.stdout, log);
}

/** Start a fresh noninteractive activation without loading personal executable configuration. */
function invocation(
  executable: string,
  cwd: string,
  log: string,
  options: AgentInspection['request']['options'],
  tools: NativeTools,
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
    ...settings(executable, cwd, log, options, tools.url),
    ...(tools.schema ? ['--output-schema', tools.schema] : []),
    '-',
  ];
}

/** Disable executable tools while retaining native guidance and provider-level web policy. */
function settings(
  executable: string,
  cwd: string,
  log: string,
  options: AgentInspection['request']['options'],
  url: string,
) {
  const config = [
    'approval_policy="never"',
    'default_permissions="arcnexus"',
    `permissions.arcnexus.filesystem={":minimal"="read","/sys/fs/cgroup"="read",${JSON.stringify(executable)}="read",${JSON.stringify(cwd)}="read",${JSON.stringify(log.slice(0, log.lastIndexOf('/')))}="read"}`,
    'permissions.arcnexus.network.enabled=false',
    ...unusedFeatures.map((feature) => `features.${feature}=false`),
    `mcp_servers={arcnexus={url=${JSON.stringify(url)},required=true,default_tools_approval_mode="approve"}}`,
    `model_reasoning_effort=${JSON.stringify(options.modelReasoningEffort)}`,
    `web_search=${JSON.stringify(options.webSearchMode)}`,
  ];
  return config.flatMap((entry) => ['-c', entry]);
}

/** Decode the final structured response while keeping the original stream in evidence. */
export function decodeCodexAnswer(stdout: string, log: string): unknown {
  let message: string | undefined;
  for (const line of stdout.trim().split('\n').filter(Boolean)) {
    const event = JSON.parse(line);
    if (event.type === 'item.completed' && event.item?.type === 'agent_message')
      message = event.item.text;
  }
  if (!message)
    throw new InvalidCodexResponse(`Codex returned no final response; evidence: ${log}`, {
      identity: 'Codex returned no final response',
    });
  try {
    return JSON.parse(message);
  } catch (error) {
    const diagnostic = error instanceof Error ? error.message : String(error);
    throw new InvalidCodexResponse(
      `Codex returned an invalid task response: ${diagnostic}; evidence: ${log}`,
      { identity: `Codex returned an invalid task response: ${diagnostic}`, cause: error },
    );
  }
}
