import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentInspection } from '../../architecture/src/index.js';
import { execute } from './process.js';
import { CodexEvents, type CodexObservation } from './codex-events.js';
export { InvalidCodexResponse } from './codex-events.js';

interface NativeTools {
  schema?: string;
  url: string;
  stderr?: string;
  observe?(event: CodexObservation): void;
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
  const events = new CodexEvents(log, tools.observe);
  const result = await execute(executable, params, {
    cwd,
    signal,
    log,
    stderrLog: tools.stderr,
    captureOutput: false,
    output: (output) => events.accept(output),
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
  return events.answer();
}

/** Start a fresh noninteractive activation without loading personal executable configuration. */
function invocation(
  executable: string,
  cwd: string,
  log: string,
  options: AgentInspection['request']['options'],
  tools: NativeTools,
) {
  const params = [
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
  tools.observe?.({ kind: 'invocation', command: executable, args: params, cwd });
  return params;
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
  const events = new CodexEvents(log);
  events.accept({ channel: 'stdout', text: stdout });
  return events.answer();
}
