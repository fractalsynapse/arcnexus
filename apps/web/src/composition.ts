import { Context, type Component } from 'cordis';
import { uiPlugin, type CommandBinding } from '../../../packages/ui/src/index.js';
import { commandBindingPlugin } from './plugins/command-binding-plugin.js';
import { framePlugin } from './plugins/frame-plugin.js';
import { workspacePlugin } from './plugins/workspace-plugin.js';

/** Mount the same browser composition for the local app and controlled acceptance. */
export async function mountWeb(
  element: HTMLElement,
  commands: CommandBinding,
  feature?: Component,
) {
  const context = new Context();
  await context.use(uiPlugin);
  await context.use(workspacePlugin());
  if (feature) await context.use(feature);
  await context.use(commandBindingPlugin(commands));
  await context.use(framePlugin(element));
  return context;
}
