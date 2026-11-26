import type { Context } from 'cordis';
import { connectionManagementPlugin } from './connection-management-plugin.js';
import { planPlugin } from './plan-plugin.js';
import { planFilePlugin } from './plan-file-plugin.js';
import { projectManagementPlugin } from './project-management-plugin.js';
import './platform.css';

export const platformUiPlugin = {
  inject: ['ui', 'webPlatform'],
  /** Compose the authenticated platform's independent browser features. */
  async apply(context: Context) {
    await context.use(connectionManagementPlugin);
    await context.use(projectManagementPlugin);
    await context.use(planPlugin);
    await context.use(planFilePlugin);
  },
};
