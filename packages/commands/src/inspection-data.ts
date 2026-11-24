import type { Context } from 'cordis';
import { z } from 'zod';
import { dataOperation, type DataScope } from '../../data/src/index.js';

const selection = z.strictObject({ component: z.string().min(1), activity: z.string().min(1) });
const inspection = z.strictObject({
  actor: z.string(),
  component: z.string(),
  activity: z.string(),
  placeholders: z.array(z.string()),
  request: z.strictObject({ input: z.string(), options: z.record(z.string(), z.unknown()) }),
});

type Project = { directory: string; revision: string };

/** Register a project-scoped, read-only projection of the Commands inspection. */
export function commandInspectionPlugin(
  resolve: (scope: DataScope) => Promise<Project | undefined>,
) {
  return {
    inject: ['commands', 'data'],
    /** Resolve a pinned project from trusted bindings before invoking Commands. */
    apply(context: Context) {
      const read = dataOperation(selection, inspection, async (scope, input) => {
        const project = await resolve(scope);
        if (!project) throw new Error('Project inspection is unavailable');
        return context.commands.inspect({ ...input, ...project });
      });
      context.effect(() => context.data.register({ id: 'agent-inspection', operations: { read } }));
    },
  };
}
