import type { Context } from 'cordis';
import { z } from 'zod';
import {
  documentationSettings,
  validateDocumentationDirectories,
  type Capture,
} from '../../architecture/src/index.js';
import { dataOperation, type DataScope } from '../../data/src/index.js';

type ResolveCapture = (scope: DataScope) => Promise<Capture | undefined>;

/** Publish settings from the same verified revision used by the project's commands. */
export function projectSettingsPlugin(capture: ResolveCapture) {
  return {
    inject: ['data', 'catalog'],
    /** Keep the project settings read scoped to the authenticated project. */
    apply(context: Context) {
      context.effect(() =>
        context.data.register({
          id: 'project-settings',
          operations: settingsOperations(context.catalog, capture),
        }),
      );
    },
  };
}

function settingsOperations(catalog: Context['catalog'], capture: ResolveCapture) {
  const open = async (scope: DataScope) => {
    const project = await capture(scope);
    if (!project) throw new Error('Project settings are unavailable until setup is complete');
    return project;
  };
  return {
    read: dataOperation(z.strictObject({}), documentationSettings, async (scope) => {
      const project = await open(scope);
      const saved = await catalog.documentationDirectories(scope.principal, scope.project);
      return {
        revision: project.source.revision,
        directories: saved ?? project.project.documentationDirectories ?? [],
      };
    }),
    update: dataOperation(documentationSettings, documentationSettings, async (scope, settings) => {
      const project = await open(scope);
      const directories = validateDocumentationDirectories(project, settings.directories);
      await catalog.saveDocumentationDirectories(
        scope.principal,
        scope.project,
        settings.revision,
        directories,
      );
      return { revision: settings.revision, directories };
    }),
  };
}
