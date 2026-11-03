import { parseArgs } from 'node:util';
import { InputError } from '../../library/architecture/config.js';

export const help = `ArcNexus
  workday start [package] [--simulate]
  workday pause|resume|stop|status [id]
  task run [package] "<prompt>" [--async] [--simulate]
  task pause|resume|stop <id> | answer <id> "<response>"
  task list [field=value...] | get <id> [--follow] | follow <id>
  workday list [field=value...] | get <id> [--follow]
  workspace cleanup <package> [--workspace <id>]
  workspace prepare <package>
  workspace list [package] | get <id> [--follow]
  config get <name> | update <name> <value> | migrate [target] [--write]
  platform list|get <id>|create <id> <repository>|remove <id>
  package list [platform]|get <package>|create <platform/package> <repository>|remove <package>
  platform update <id> <field=value>...
  package update <package> <field=value>...
  component update <package> <id> <field=value>...
  standard list <platform> [field=value...] | get <platform> <id>
  component list <package> [field=value...] | get <package> <id>
  test inspect|run [package] [--component <id>] [--level unit|integration|acceptance] [--category regression] [--tag <tag>] [--json]
Inspection, evidence and diagnostics:
  inspect <component-id> <objective> --project <repository> [--kind change|research|review] [--json]
  inspect: --assignment <file> replaces objective
  validate [package]
  inspect <package> <component> [prompt] [--activity research|document|design|implement|review|release]
  experiment inspect <manifest> --bindings <file> [--json]
  experiment run <prompt-manifest> --bindings <file> --mode simulation|live [--output <new-directory>]
  workday inspect <historical-manifest> --project <repository> [--base <ref>] [--bindings <file>] [--json]
  workday history <historical-workday-id> [--json]
  workday follow <historical-workday-id> [--json] [--after <sequence>]
  task inspect <historical-proposal-id> [--json]
  prepare --project <repository>
  status <workspace-id> [--json]
  follow <workspace-id> [--json] [--after <sequence>]
  cleanup <workspace-id>
Lists: --search <text> --limit <1-100> --cursor <token>
Run following: --after <event-sequence>
Composed workspace inspection/preparation: --bindings <file>
`;

const cliOptions = {
  workspace: { type: 'string' },
  write: { type: 'boolean' },
  async: { type: 'boolean' },
  simulate: { type: 'boolean' },
  follow: { type: 'boolean' },
  search: { type: 'string' },
  limit: { type: 'string' },
  cursor: { type: 'string' },
  component: { type: 'string' },
  activity: { type: 'string' },
  level: { type: 'string' },
  category: { type: 'string' },
  tag: { type: 'string', multiple: true },
  mode: { type: 'string' },
  output: { type: 'string' },
  bindings: { type: 'string' },
  after: { type: 'string' },
  'composition-profile': { type: 'string' },
  'execution-profile': { type: 'string' },
  assignment: { type: 'string' },
  kind: { type: 'string' },
  json: { type: 'boolean' },
  project: { type: 'string' },
  input: { type: 'string' },
  model: { type: 'string' },
  'initializer-model': { type: 'string' },
  'codex-path': { type: 'string' },
  'max-attempts': { type: 'string' },
  base: { type: 'string' },
  issue: { type: 'string' },
  'timeout-seconds': { type: 'string' },
  help: { type: 'boolean' },
  version: { type: 'boolean' },
} as const;

export function argumentsForCommand() {
  try {
    const parsed = parseArgs({
      allowPositionals: true,
      options: cliOptions,
    });
    if (
      parsed.positionals[0] !== 'test' &&
      (parsed.values.component ||
        parsed.values.level ||
        parsed.values.category ||
        parsed.values.tag)
    )
      throw new InputError('Test filters require the test command');
    if (parsed.values.write !== undefined && parsed.positionals[0] !== 'config')
      throw new InputError('--write requires config migrate');
    if (
      parsed.values.workspace !== undefined &&
      parsed.positionals.slice(0, 2).join(' ') !== 'workspace cleanup'
    )
      throw new InputError('--workspace requires workspace cleanup');
    return parsed;
  } catch (error) {
    throw new InputError(String(error));
  }
}

export type CliValues = Omit<ReturnType<typeof argumentsForCommand>['values'], 'tag'>;
