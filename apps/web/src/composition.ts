import { Context } from 'cordis';
import { createElement as h } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon, uiPlugin, WebFrame } from '../../../packages/ui/src/index.js';
import type { CommandBinding } from '../../../packages/ui/src/index.js';

declare module 'cordis' {
  interface Context {
    webCommands: CommandBinding;
  }
}

const refine = h(RefineAction);
const workspaces = [
  { path: '/plan/', label: 'Plan', headerAction: refine },
  { path: '/architect/', label: 'Architect', headerAction: refine },
  { path: '/run/', label: 'Run', headerAction: refine },
  { path: '/release/', label: 'Release' },
];

function workspacePlugin(content?: ReactNode) {
  return {
    inject: ['ui'],
    /** Register the frame's workspace links and route-specific header action. */
    apply(context: Context) {
      for (const item of workspaces) {
        context.effect(() =>
          context.ui.register({
            ...item,
            content,
          }),
        );
      }
    },
  };
}

function RefineAction() {
  return h(
    'button',
    { type: 'button', className: 'arc-button', disabled: true },
    h(Icon, { name: 'refine' }),
    'Refine',
  );
}

function commandBindingPlugin(binding: CommandBinding) {
  return {
    /** Publish the command binding selected for this web composition. */
    apply(context: Context) {
      context.provide('webCommands', binding);
    },
  };
}

function framePlugin(element: HTMLElement) {
  return {
    inject: ['ui', 'webCommands'],
    /** Render the registered application and release the React tree on disposal. */
    apply(context: Context) {
      context.effect(() => {
        const root = createRoot(element);
        root.render(
          h(WebFrame, { workspaces: context.ui.workspaces(), commands: context.webCommands }),
        );
        return () => root.unmount();
      });
    },
  };
}

/** Mount the same browser composition for the local app and controlled acceptance. */
export async function mountWeb(
  element: HTMLElement,
  commands: CommandBinding,
  content?: ReactNode,
) {
  const context = new Context();
  await context.use(uiPlugin);
  await context.use(workspacePlugin(content));
  await context.use(commandBindingPlugin(commands));
  await context.use(framePlugin(element));
  return context;
}
