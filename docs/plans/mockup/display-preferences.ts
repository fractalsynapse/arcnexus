import { z } from 'zod';

const panelId = z
  .templateLiteral(['arc-', z.string()])
  .refine((id) => /^arc-[a-z][a-z\d-]*$/.test(id));
const color = z.string().regex(/^#[a-f\d]{6}$/i);
const palette = z.object({
  background: color.optional(),
  text: color.optional(),
  accent: color.optional(),
});
export const columns = [1, 2, 3] as const;
export type Layout = (typeof columns)[number];
export type PanelId = z.infer<typeof panelId>;
export type Palette = z.infer<typeof palette>;
export const defaultOrder: PanelId[] = [
  'arc-planner-metrics',
  'arc-planner-outcome',
  'arc-event-log',
  'arc-files',
];

const regions = z.record(panelId, z.number().int().nonnegative().optional());
const layoutSettings = z.object({ widths: z.array(z.number().positive()), regions });
const preferences = z.object({
  layout: z.literal(columns),
  order: z.array(panelId),
  layouts: z.object({ 1: layoutSettings, 2: layoutSettings, 3: layoutSettings }),
  site: palette,
  panels: z.record(panelId, palette.optional()),
});
export type Preferences = z.infer<typeof preferences>;

export function defaultDisplay(): Preferences {
  return {
    layout: 2,
    order: [...defaultOrder],
    layouts: {
      1: { widths: [1], regions: {} },
      2: { widths: [1, 1], regions: { 'arc-planner-outcome': 1, 'arc-files': 1 } },
      3: {
        widths: [1, 1, 1],
        regions: { 'arc-event-log': 1, 'arc-planner-outcome': 2, 'arc-files': 2 },
      },
    },
    site: {},
    panels: {},
  };
}

const storageKey = 'arcnexus.mockup.plan-display';
export let display = readDisplay();

function readDisplay() {
  try {
    const value = preferences.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? 'null'));
    if (value.success) {
      value.data.order = [...new Set(value.data.order)];
      return value.data;
    }
  } catch {
    // Viewer environments may disable storage.
  }
  return defaultDisplay();
}

export function saveDisplay(value = display) {
  display = value;
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // The current preview can still use the selected preferences.
  }
}

export function panelRegion(settings: Preferences, id: PanelId) {
  return Math.min(settings.layout - 1, settings.layouts[settings.layout].regions[id] ?? 0);
}
