import { Context } from 'cordis';
import { createElement as h } from 'react';
import type { Component } from 'cordis';
import { createRoot } from 'react-dom/client';
import { Button, uiPlugin, WebFrame } from '../../../packages/ui/src/index.js';
import type { CommandBinding } from '../../../packages/ui/src/index.js';

declare module 'cordis' {
  interface Context {
    webCommands: CommandBinding;
  }
}

const refine = h(Button, { icon: 'refine', disabled: true }, 'Refine');
const workspaces = [
  { path: '/plan/', label: 'Plan', headerAction: refine, defaultColumns: 2 as const },
  { path: '/architect/', label: 'Architect', headerAction: refine, defaultColumns: 2 as const },
  { path: '/run/', label: 'Run', headerAction: refine },
  { path: '/release/', label: 'Release', headerAction: refine },
];

function workspacePlugin() {
  return {
    inject: ['ui'],
    /** Register the frame's workspace links and route-specific header action. */
    apply(context: Context) {
      for (const item of workspaces) {
        context.effect(() => context.ui.register(item));
      }
    },
  };
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
        root.render(h(WebFrame, { registry: context.ui, commands: context.webCommands }));
        return () => root.unmount();
      });
    },
  };
}

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
