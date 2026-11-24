import type { Context } from 'cordis';
import { z } from 'zod';
import type { Capture } from '../../architecture/src/index.js';
import { dataOperation, type DataScope } from '../../data/src/index.js';
import { goalDirectory, goalInventory } from './inventory.js';

const revision = z.string().optional();
const listInput = z.strictObject({ revision });
const readInput = z.strictObject({ revision, id: z.string() });
const summary = z.strictObject({
  id: z.string(),
  priority: z.number().int().optional(),
  path: z.string(),
});
const summaries = z.strictObject({ revision: z.string(), entries: z.array(summary) });
const file = z.strictObject({ revision: z.string(), entry: summary, content: z.string() });

export type ResolvePlanCapture = (
  scope: DataScope,
  revision?: string,
) => Capture | undefined | Promise<Capture | undefined>;

type Select = (capture: Capture) => Array<z.output<typeof summary>>;

function goals(capture: Capture) {
  return goalInventory(capture).map(({ id, priority }) => ({
    id,
    priority,
    path: goalDirectory(capture) + '/' + id + '.md',
  }));
}

function objectives(capture: Capture) {
  const prefix = (capture.project.knowledgeRoot ?? '.arc') + '/objectives/';
  return capture.source.paths.flatMap((path) => {
    if (!path.startsWith(prefix) || !path.endsWith('.md')) return [];
    const id = path.slice(prefix.length, -3);
    return id && !id.includes('/') ? [{ id, path }] : [];
  });
}

/** Resolve the same approved revision for list and detail reads. */
function guides(id: string, select: Select, resolve: ResolvePlanCapture) {
  const open = async (scope: DataScope, expected?: string) => {
    const capture = await resolve(scope, expected);
    if (!capture || (expected !== undefined && expected !== capture.source.revision))
      throw new Error('Plan revision unavailable');
    return capture;
  };
  return {
    id,
    operations: {
      list: dataOperation(listInput, summaries, async (scope, input) => {
        const capture = await open(scope, input.revision);
        return { revision: capture.source.revision, entries: select(capture) };
      }),
      read: dataOperation(readInput, file, async (scope, input) => {
        const capture = await open(scope, input.revision);
        const entry = select(capture).find((item) => item.id === input.id);
        if (!entry) throw new Error('Plan file unavailable');
        return {
          revision: capture.source.revision,
          entry,
          content: capture.source.read(entry.path),
        };
      }),
    },
  };
}

/** Publish the Planner-owned guide collections without invoking a planning workflow. */
export function plannerDataPlugin(resolve: ResolvePlanCapture) {
  return {
    inject: ['data'],
    /** Register both guide collections for the selected trusted project. */
    apply(context: Context) {
      context.effect(() => context.data.register(guides('goals', goals, resolve)));
      context.effect(() => context.data.register(guides('objectives', objectives, resolve)));
    },
  };
}
