import type { Context } from 'cordis';
import { z } from 'zod';
import { documentationSettings, type Capture } from '../../architecture/src/index.js';
import { dataOperation, type DataScope } from '../../data/src/index.js';

/** Publish settings from the same verified revision used by the project's commands. */
export function projectSettingsPlugin(capture: (scope: DataScope) => Promise<Capture | undefined>) {
  const read = dataOperation(z.strictObject({}), documentationSettings, async (scope) => {
    const project = await capture(scope);
    if (!project) throw new Error('Project settings are unavailable until setup is complete');
    return {
      revision: project.source.revision,
      directories: project.project.documentationDirectories ?? [],
    };
  });
  return {
    inject: ['data'],
    /** Keep the project settings read scoped to the authenticated project. */
    apply(context: Context) {
      context.effect(() => context.data.register({ id: 'project-settings', operations: { read } }));
    },
  };
}
