#!/usr/bin/env node
import { Context } from 'cordis';
import { agentPlugin } from '../../../packages/agent/src/index.js';
import { architecturePlugin } from '../../../packages/architecture/src/index.js';
import { commandsPlugin } from '../../../packages/commands/src/index.js';
import { teamPlugin } from '../../../packages/team/src/index.js';
import { workflowPlugin } from '../../../packages/workflow/src/index.js';
import { runTask } from './task.js';

/** Read the global output flag before dispatching and reject ambiguous placement. */
function parseOutputOption(args: string[]) {
  const flag = '--json';
  const index = args.indexOf(flag);
  if (index === -1) return { positionals: args, json: false };
  if (args.lastIndexOf(flag) !== index || (index !== 0 && index !== args.length - 1)) {
    throw new Error('Use --json once, before the command or after its arguments');
  }
  return { positionals: index === 0 ? args.slice(1) : args.slice(0, -1), json: true };
}

/** Validate a terminal request before mounting services or admitting work. */
async function main(args: string[]) {
  const { positionals, json } = parseOutputOption(args);
  const [command, component, activity, ...extra] = positionals;
  if (command === 'task' || command === 'architecture')
    return runCommand(command, component, activity, extra, json);
  if (command === 'refine') {
    const rounds = parseRounds(positionals.slice(1));
    return runTask(await mountCommands(true), undefined, json, 'refine', rounds);
  }
  if (command !== 'inspect')
    throw new Error(`Command unavailable in this build: ${command ?? '<missing>'}`);
  if (
    !component ||
    !activity ||
    extra.length ||
    component.startsWith('-') ||
    activity.startsWith('-')
  ) {
    throw new Error('Usage: arcnexus inspect <component> <activity>');
  }
  const commands = await mountCommands();
  const result = commands.inspect({ component, activity, directory: process.cwd() });
  console.log(json ? JSON.stringify(result, null, 2) : renderInspection(result));
}

/** Accept one positive decimal round count without imposing a resource ceiling. */
function parseRounds(args: string[]): string {
  if (
    args.length !== 0 &&
    (args.length !== 2 ||
      args[0] !== '--rounds' ||
      args[1] === undefined ||
      !/^[0-9]+$/.test(args[1]))
  ) {
    throw new Error('Usage: arcnexus refine [--rounds <N>]');
  }
  if (args.length === 0) return 1;
  const rounds = Number(args[1]);
  if (!Number.isInteger(rounds) || rounds < 1)
    throw new Error('Usage: arcnexus refine [--rounds <N>]');
  return rounds;
}

/** Compose the trusted CLI services for either command. */
async function mountCommands(task = false) {
  const context = new Context();
  for (const plugin of [teamPlugin, architecturePlugin, agentPlugin]) {
    await context.use(plugin);
  }
  if (task) await (await import('./host.js')).mountTaskHost(context);
  else await context.use(workflowPlugin());
  await context.use(commandsPlugin);
  return context.commands;
}

/** Show the invocation header followed by the complete prompt from the SDK. */
function renderInspection(result: ReturnType<Context['commands']['inspect']>) {
  return [
    `Placeholders: ${result.placeholders.join(', ')}`,
    'Invocation options:',
    JSON.stringify(result.request.options, null, 2),
    '--- Codex input ---',
    result.request.input,
  ].join('\n');
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}

/** Validate engineering command arguments before mounting the foreground production host. */
async function runCommand(
  command: string,
  component: string | undefined,
  activity: string | undefined,
  extra: string[],
  json: boolean,
) {
  if (command === 'architecture') {
    if (component !== 'update' || extra.length || (activity !== undefined && !activity.trim()))
      throw new Error('Usage: arcnexus architecture update ["<feedback>"]');
    return runTask(await mountCommands(true), activity, json, 'update');
  }
  if (command === 'task') {
    const usage = component === 'plan' ? 'plan ["<objective>"]' : 'run ["<goal>"]';
    if (
      (component !== 'run' && component !== 'plan') ||
      (activity !== undefined && !activity.trim()) ||
      extra.length
    )
      throw new Error(`Usage: arcnexus task ${usage}`);
    return runTask(await mountCommands(true), activity, json, component);
  }
}
