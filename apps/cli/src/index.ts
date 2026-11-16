#!/usr/bin/env node
import { Context } from 'cordis';
import { agentPlugin } from '../../../packages/agent/src/index.js';
import { architecturePlugin } from '../../../packages/architecture/src/index.js';
import { commandsPlugin } from '../../../packages/commands/src/index.js';

/** Validate the CLI arguments and print the prepared input with its invocation header. */
async function main(args: string[]) {
  const [command, component, activity, ...extra] = args;
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
  const context = new Context();
  for (const plugin of [architecturePlugin, agentPlugin, commandsPlugin]) {
    await context.use(plugin);
  }
  const result = context.commands.inspect({ component, activity, directory: process.cwd() });
  console.log(
    [
      `Placeholders: ${result.placeholders.join(', ')}`,
      'Invocation options:',
      JSON.stringify(result.request.options, null, 2),
      '--- Codex input ---',
      result.request.input,
    ].join('\n'),
  );
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
