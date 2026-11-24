import type { Context } from 'cordis';
import { UiRegistry } from './ui-registry.js';

declare module 'cordis' {
  interface Context {
    ui: UiRegistry;
  }
}

export const uiPlugin = {
  /** Provide the shared UI registration service to browser composition. */
  apply(context: Context) {
    context.provide('ui', new UiRegistry());
  },
};
