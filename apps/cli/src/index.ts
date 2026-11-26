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
  if (command === 'platform') return runPlatform(component, activity, extra, json);
  if (command === 'task' || command === 'architecture')
    return runCommand(command, component, activity, extra, json);
  if (command === 'refine') {
    const rounds = parseRounds(positionals.slice(1));
    return runTask(await mountCommands(true), { command: 'refine', rounds }, json);
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
  printInspection(result, json);
}

/** Route explicit hosted inspection through REST while reusing terminal rendering. */
async function runPlatform(
  verb: string | undefined,
  component: string | undefined,
  rest: string[],
  json: boolean,
) {
  if (verb && verb !== 'inspect') {
    const { runPlatformWorkflow } = await import('./platform-workflow.js');
    return runPlatformWorkflow(verb, component ? [component, ...rest] : rest, json);
  }
  const [activity, extra] = rest;
  if (
    verb !== 'inspect' ||
    !component ||
    !activity ||
    extra !== undefined ||
    component.startsWith('-') ||
    activity.startsWith('-')
  )
    throw new Error('Usage: arcnexus platform inspect <component> <activity>');
  const { inspectPlatform } = await import('./platform-inspect.js');
  printInspection(await inspectPlatform(component, activity), json);
}

function printInspection(result: ReturnType<Context['commands']['inspect']>, json: boolean) {
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
  if (args.length === 0) return '1';
  const rounds = args[1];
  if (rounds === undefined || !/[1-9]/.test(rounds))
    throw new Error('Usage: arcnexus refine [--rounds <N>]');
  return rounds;
}

/** Compose the trusted CLI services for either command. */
async function mountCommands(task = false) {
  const context = new Context();
  for (const plugin of [teamPlugin, architecturePlugin, agentPlugin]) {
    await context.use(plugin);
  }
  if (task) await context.use((await import('../../host/src/index.js')).hostPlugin());
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
    return runTask(
      await mountCommands(true),
      { command: 'architecture_update', feedback: activity },
      json,
    );
  }
  if (command === 'task') {
    const request = taskRequest(component, activity, extra);
    return runTask(await mountCommands(true), request, json);
  }
}

function taskRequest(component: string | undefined, activity: string | undefined, extra: string[]) {
  if (component === 'plan' && activity === '--recommend-objectives') {
    const [focus] = extra;
    if (extra.length > 1 || (focus !== undefined && !focus.trim()))
      throw new Error('Usage: arcnexus task plan --recommend-objectives ["<focus>"]');
    return { command: 'task_plan', mode: 'recommend-objectives', focus } as const;
  }
  if (
    (component !== 'plan' && component !== 'run') ||
    extra.length ||
    (activity !== undefined && (!activity.trim() || activity.startsWith('--')))
  )
    throw new Error(
      component === 'plan'
        ? 'Usage: arcnexus task plan ["<objective>"] or task plan --recommend-objectives ["<focus>"]'
        : 'Usage: arcnexus task run ["<goal>"]',
    );
  return component === 'plan'
    ? ({ command: 'task_plan', objective: activity } as const)
    : ({ command: 'task_run', goal: activity } as const);
}
