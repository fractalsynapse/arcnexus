import type { Context } from 'cordis';
import { createElement as h } from 'react';
import { createRoot } from 'react-dom/client';
import { WebFrame } from '../../../../packages/ui/src/index.js';

export function framePlugin(element: HTMLElement) {
  return {
    inject: ['ui', 'webCommands', 'uiPreferences'],
    /** Render the registered application and release the React tree on disposal. */
    apply(context: Context) {
      context.effect(() => {
        const root = createRoot(element);
        root.render(
          h(WebFrame, {
            registry: context.ui,
            commands: context.webCommands,
            preferences: context.uiPreferences,
          }),
        );
        return () => root.unmount();
      });
    },
  };
}
