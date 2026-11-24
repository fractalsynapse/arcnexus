import { oneColumn } from './one-column.js';
import { twoColumns } from './two-columns.js';
import { threeColumns } from './three-columns.js';

export const panelLayouts = [oneColumn, twoColumns, threeColumns] as const;
export type PanelLayoutDefinition = (typeof panelLayouts)[number];
export type ColumnCount = PanelLayoutDefinition['columns'];
export const columnCounts = panelLayouts.map(({ columns }) => columns);

/** Resolve the configuration shared by the settings preview and panel placement. */
export function panelLayoutFor(columns: ColumnCount): PanelLayoutDefinition {
  return panelLayouts.find((layout) => layout.columns === columns) ?? oneColumn;
}
