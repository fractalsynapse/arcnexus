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
  known: z.array(panelId).optional(),
  arranged: z.boolean().optional(),
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
    known: [...defaultOrder],
    arranged: true,
  };
}

const legacyKey = 'arcnexus.mockup.plan-display';
const siteKey = 'arcnexus.mockup.site-appearance';
const pages = new Map<string, Preferences>();
let page = '/plan/';
let site = read(siteKey, palette) ?? read(legacyKey, preferences)?.site ?? {};
export let display = defaultDisplay();

function read<T>(key: string, schema: z.ZodType<T>) {
  try {
    return schema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null')).data;
  } catch {
    // Viewer environments may disable storage.
  }
}

function pageKey(route: string) {
  return 'arcnexus.mockup.display' + route;
}

export function openDisplay(route: string, defaults: Preferences, available: PanelId[]) {
  page = route;
  const legacy = route === '/plan/' ? read(legacyKey, preferences) : undefined;
  display = pages.get(route) ?? read(pageKey(route), preferences) ?? legacy ?? defaults;
  const known = display.known ?? defaults.known ?? defaults.order;
  display.order = [
    ...new Set([...display.order, ...available.filter((id) => !known.includes(id))]),
  ];
  display.known = [...new Set([...known, ...available])];
  display.arranged ??= defaults.arranged;
  display.site = site;
  pages.set(route, display);
}

export function saveDisplay(value = display) {
  display = value;
  site = value.site;
  pages.set(page, value);
  try {
    localStorage.setItem(pageKey(page), JSON.stringify(value));
    localStorage.setItem(siteKey, JSON.stringify(site));
  } catch {
    // The current preview can still use the selected preferences.
  }
}

export function panelRegion(settings: Preferences, id: PanelId) {
  return Math.min(settings.layout - 1, settings.layouts[settings.layout].regions[id] ?? 0);
}
