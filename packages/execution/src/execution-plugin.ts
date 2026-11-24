import type { Context } from 'cordis';
import type { RuntimeImage } from '../../foundation/src/runtime-image.js';
import { applicationStorage } from './host-config.js';
import { Execution } from './execution.js';

/** Give every Host service the same trusted storage root. */
export function executionPluginFor(storage?: string, runtime?: RuntimeImage) {
  return {
    inject: ['architecture', 'coordination'],
    /** Register the production implementation used by Workflow's host calls. */
    apply(context: Context) {
      context.provide(
        'execution',
        new Execution(
          context.architecture,
          context.coordination,
          storage ?? applicationStorage(),
          runtime,
        ),
      );
    },
  };
}

export const executionPlugin = executionPluginFor();
