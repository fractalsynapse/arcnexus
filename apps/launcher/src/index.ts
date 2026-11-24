import type { Context } from 'cordis';
export { hostAssignmentSchema, type HostAssignment } from './host-assignment.js';
export { startHost } from './host-runtime.js';
import { enroll, status, connect } from './connection.js';

export { endpoint, type Identity } from './connection.js';

declare module 'cordis' {
  interface Context {
    launcher: { enroll: typeof enroll; status: typeof status; connect: typeof connect };
  }
}

export const launcherPlugin = {
  /** Provide the enrollment and management client to launcher compositions. */
  apply(context: Context) {
    context.provide('launcher', { enroll, status, connect });
  },
};
