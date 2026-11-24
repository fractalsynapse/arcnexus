import { Context, type Component } from 'cordis';
import {
  uiPlugin,
  type CommandBinding,
  type CommandState,
} from '../../../packages/ui/src/index.js';
import { commandBindingPlugin } from './plugins/command-binding-plugin.js';
import { framePlugin } from './plugins/frame-plugin.js';
import { workspacePlugin } from './plugins/workspace-plugin.js';

const unavailable: CommandState = { status: 'Unavailable', supported: [] };
const unavailableCommands: CommandBinding = {
  getSnapshot: () => unavailable,
  subscribe: () => () => {},
};

/** Mount the same browser composition for the local app and controlled acceptance. */
export async function mountWeb(
  element: HTMLElement,
  commands?: CommandBinding,
  feature?: Component,
) {
  const context = new Context();
  await context.use(uiPlugin);
  if (feature) await context.use(feature);
  if (commands || !context.webCommands)
    await context.use(commandBindingPlugin(commands ?? unavailableCommands));
  await context.use(workspacePlugin());
  await context.use(framePlugin(element));
  return context;
}
