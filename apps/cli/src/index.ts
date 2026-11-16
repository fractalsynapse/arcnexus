#!/usr/bin/env node
import { Context } from 'cordis';
import { agentPlugin } from '../../../packages/agent/src/index.js';
import { architecturePlugin } from '../../../packages/architecture/src/index.js';
import { commandsPlugin } from '../../../packages/commands/src/index.js';
import { managerPlugin } from '../../../packages/manager/src/index.js';

/** Validate the CLI arguments and print the complete shared SDK result. */
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
  for (const plugin of [managerPlugin, architecturePlugin, agentPlugin, commandsPlugin]) {
    await context.use(plugin);
  }
  const result = context.commands.inspect({ component, activity, directory: process.cwd() });
  console.log(JSON.stringify(result, null, 2));
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
}
