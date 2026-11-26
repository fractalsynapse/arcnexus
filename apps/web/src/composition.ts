import { Context, type Component } from 'cordis';
import {
  uiPlugin,
  type CommandBinding,
  type CommandState,
} from '../../../packages/ui/src/index.js';
import { commandBindingPlugin } from './plugins/command-binding-plugin.js';
import { framePlugin } from './plugins/frame-plugin.js';
import { workspacePlugin } from './plugins/workspace-plugin.js';
import { preferencesPlugin } from './plugins/preferences-plugin.js';
import { browserPlatformPlugin, type PlatformOptions } from './platform/browser-platform.js';
import { platformCommandsPlugin } from './platform/command-binding.js';

const unavailable: CommandState = { status: 'Unavailable', supported: [] };
const unavailableCommands: CommandBinding = {
  getSnapshot: () => unavailable,
  subscribe: () => () => {},
};

interface WebComposition {
  commands?: CommandBinding | 'hosted';
  feature?: Component;
  platform?: PlatformOptions;
}

/** Mount the same browser composition for the local app and controlled acceptance. */
export async function mountWeb(
  element: HTMLElement,
  { commands, feature, platform }: WebComposition = {},
) {
  const context = new Context();
  await context.use(uiPlugin);
  await context.use(browserPlatformPlugin(platform));
  await context.use(
    commands === 'hosted'
      ? platformCommandsPlugin
      : commandBindingPlugin(commands ?? unavailableCommands),
  );
  if (feature) await context.use(feature);
  await context.use(workspacePlugin());
  await context.use(preferencesPlugin);
  await context.use(framePlugin(element));
  return context;
}
