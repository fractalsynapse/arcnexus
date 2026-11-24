import { z } from 'zod';
import type { Workspace, DisplayRegistration } from '../../registry/workspace.js';
import { columnCounts, panelLayoutFor } from '../panels/presets/index.js';

const stored = z.object({
  columns: z.literal(columnCounts),
  order: z.array(z.string()),
  hidden: z.array(z.string()),
  regions: z.record(z.string(), z.number().int().nonnegative()),
  widths: z.array(z.number().positive()),
});

export type PagePreferences = z.infer<typeof stored>;

function key(path: string) {
  return 'arcnexus.web.layout:' + path;
}

/** Read the per-workspace layout without trusting values stored in the browser. */
export function loadLayout(workspace: Workspace): PagePreferences {
  try {
    const prefs = stored.safeParse(JSON.parse(localStorage.getItem(key(workspace.path)) ?? 'null'));
    if (prefs.success) return prefs.data;
  } catch {}
  return { columns: workspace.defaultColumns ?? 1, order: [], hidden: [], regions: {}, widths: [] };
}

/** Save choices independently of the global site theme. */
export function saveLayout(path: string, layout: PagePreferences) {
  try {
    localStorage.setItem(key(path), JSON.stringify(layout));
  } catch {}
}

/** Keep registered defaults and saved order in one list, including newly installed displays. */
export function orderedDisplays(panels: readonly DisplayRegistration[], order: readonly string[]) {
  const slots = new Map(order.map((id, index) => [id, index]));
  return [...panels].sort(
    (left, right) => (slots.get(left.id) ?? order.length) - (slots.get(right.id) ?? order.length),
  );
}

/** Resolve a display's desktop placement within the selected layout. */
export function panelColumn(panel: DisplayRegistration, layout: PagePreferences) {
  return Math.min(
    panelLayoutFor(layout.columns).regions.length - 1,
    layout.regions[panel.id] ?? panel.defaultColumn ?? 0,
  );
}
