import type { Context } from 'cordis';
import { enroll, status } from './connection.js';

export { endpoint, type Identity } from './connection.js';

declare module 'cordis' {
  interface Context {
    launcher: { enroll: typeof enroll; status: typeof status };
  }
}

export const launcherPlugin = {
  /** Provide the enrollment and management client to launcher compositions. */
  apply(context: Context) {
    context.provide('launcher', { enroll, status });
  },
};
