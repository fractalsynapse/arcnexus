import type { Workspace, DisplayRegistration } from '../../registry/workspace.js';
import { useUiPreferences } from '../../preferences/browser.js';
import type { PagePreferences } from '../../preferences/schema.js';
export type { PagePreferences } from '../../preferences/schema.js';

/** Use the saved workspace arrangement and fall back to the registered layout. */
export function useLayoutPreference(workspace: Workspace) {
  const { entries, ready, save } = useUiPreferences();
  const current = entries.find(
    (entry) => entry.kind === 'layout' && entry.workspace === workspace.path,
  );
  const defaults: PagePreferences = {
    columns: workspace.defaultColumns ?? 1,
    order: [],
    hidden: [],
    regions: {},
    widths: [],
  };
  return {
    ready,
    preferences: current?.kind === 'layout' ? current.layout : defaults,
    save: (layout: PagePreferences) => save({ kind: 'layout', workspace: workspace.path, layout }),
  };
}

/** Keep registered defaults and saved order in one list, including newly installed displays. */
export function orderedDisplays(panels: readonly DisplayRegistration[], order: readonly string[]) {
  const slots = new Map(order.map((id, index) => [id, index]));
  return [...panels].sort(
    (left, right) => (slots.get(left.id) ?? order.length) - (slots.get(right.id) ?? order.length),
  );
}

/** Resolve a display's desktop placement within the selected layout. */
export function panelRegion(panel: DisplayRegistration, layout: PagePreferences) {
  const region = layout.regions[panel.id] ?? panel.defaultRegion ?? 0;
  return typeof region === 'number' ? Math.min(layout.columns - 1, region) : region;
}
