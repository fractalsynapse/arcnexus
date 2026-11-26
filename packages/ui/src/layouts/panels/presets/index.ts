import { oneColumn } from './one-column.js';
import { twoColumns } from './two-columns.js';
import { threeColumns } from './three-columns.js';

export const panelLayouts = [oneColumn, twoColumns, threeColumns] as const;
export type PanelLayoutDefinition = (typeof panelLayouts)[number];
export type ColumnCount = PanelLayoutDefinition['columns'];
export const columnCounts = panelLayouts.map(({ columns }) => columns);
export const fullWidthRegions = ['top', 'bottom'] as const;
export type PanelRegion = number | (typeof fullWidthRegions)[number];
const [top, bottom] = fullWidthRegions;

/** Resolve the configuration shared by the settings preview and panel placement. */
export function panelLayoutFor(columns: ColumnCount): PanelLayoutDefinition {
  return panelLayouts.find((layout) => layout.columns === columns) ?? oneColumn;
}

/** List desktop regions in visual order, with stable column indices across layouts. */
export function panelRegionsFor(layout: PanelLayoutDefinition) {
  return [
    { id: top, label: 'Top', value: top },
    ...layout.columnLabels.map((label, id) => ({ id, label, value: String(id) })),
    { id: bottom, label: 'Bottom', value: bottom },
  ];
}
