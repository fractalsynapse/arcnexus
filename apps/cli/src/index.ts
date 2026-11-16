#!/usr/bin/env node
import { Context } from 'cordis';
import { agentPlugin } from '../../../packages/agent/src/index.js';
import { architecturePlugin } from '../../../packages/architecture/src/index.js';
import { commandsPlugin } from '../../../packages/commands/src/index.js';
import { workflowPlugin } from '../../../packages/workflow/src/index.js';
import { runTask } from './task.js';

/** Read the global output flag before dispatching. Reject ambiguous flag placement. */
function parseOutputOption(args: string[]) {
  const flag = '--json';
  const index = args.indexOf(flag);
  if (index === -1) return { positionals: args, json: false };
  if (args.lastIndexOf(flag) !== index || (index !== 0 && index !== args.length - 1)) {
    throw new Error('Use --json once, before the command or after its arguments');
  }
  return { positionals: index === 0 ? args.slice(1) : args.slice(0, -1), json: true };
}

/** Validate the command and print its result using the requested output format. */
async function main(args: string[]) {
  const { positionals, json } = parseOutputOption(args);
  const [command, component, activity, ...extra] = positionals;
  if (command === 'task') {
    if (component !== 'run' || !activity?.trim() || extra.length)
      throw new Error('Usage: arcnexus task run "<goal>"');
    return runTask(await mountCommands(true), activity, json);
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

/** Compose the trusted CLI services for either command. */
async function mountCommands(task = false) {
  const context = new Context();
  for (const plugin of [architecturePlugin, agentPlugin]) {
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
