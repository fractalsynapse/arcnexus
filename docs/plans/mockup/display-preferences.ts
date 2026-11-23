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
const colors = palette.required();
const colorScheme = z.object({ id: z.string(), name: z.string(), colors });
const schemeLibrary = z.object({ site: z.string(), entries: z.array(colorScheme) });
export const columns = [1, 2, 3] as const;
export type Layout = (typeof columns)[number];
export type PanelId = z.infer<typeof panelId>;
export type Palette = z.infer<typeof palette>;
export type Colors = z.infer<typeof colors>;
export type ColorScheme = z.infer<typeof colorScheme>;
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
  scheme: z.string().default(''),
  panelSchemes: z.record(panelId, z.string().optional()).default({}),
  known: z.array(panelId).optional(),
  arranged: z.boolean().optional(),
});
const storedPreferences = preferences.extend({
  site: palette.optional(),
  panels: z.record(panelId, palette.optional()).optional(),
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
    scheme: '',
    panelSchemes: {},
    known: [...defaultOrder],
    arranged: true,
  };
}

const legacyKey = 'arcnexus.mockup.plan-display';
const schemeKey = 'arcnexus.mockup.color-schemes';
const savedSchemes = read(schemeKey, schemeLibrary);
const pages = new Map<string, Preferences>();
let page = '/plan/';
let appColors: Colors;
export const colorSchemes: z.infer<typeof schemeLibrary> = savedSchemes ?? {
  site: '',
  entries: [],
};
export let display = defaultDisplay();

function read<T>(key: string, schema: z.ZodType<T>) {
  try {
    return schema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null')).data;
  } catch {
    // Viewer environments may disable storage.
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The current preview can still use the selected preferences.
  }
}

export function initializeColorSchemes(defaultColors: Colors) {
  appColors = defaultColors;
  if (savedSchemes) return;
  const previous =
    read('arcnexus.mockup.site-appearance', palette) ?? read(legacyKey, storedPreferences)?.site;
  if (!previous || !Object.keys(previous).length) return;
  colorSchemes.site = 'previous-site';
  saveColorScheme({
    id: colorSchemes.site,
    name: 'Previous site colors',
    colors: { ...appColors, ...previous },
  });
}

export function findColorScheme(id: string | undefined) {
  return colorSchemes.entries.find((entry) => entry.id === id);
}

export function defaultSchemeColors() {
  return appColors;
}

export function saveColorScheme(scheme: ColorScheme) {
  const index = colorSchemes.entries.findIndex((entry) => entry.id === scheme.id);
  if (index < 0) colorSchemes.entries.push(scheme);
  else colorSchemes.entries[index] = scheme;
  write(schemeKey, colorSchemes);
}

export function setSiteScheme(id: string) {
  colorSchemes.site = id;
  write(schemeKey, colorSchemes);
}

function pageKey(route: string) {
  return 'arcnexus.mockup.display' + route;
}

export function openDisplay(
  route: string,
  defaults: Preferences,
  panels: ReadonlyArray<{ id: PanelId; label: string }>,
  title: string,
) {
  page = route;
  const cached = pages.get(route);
  const stored = cached ? undefined : readPage(route);
  display = cached ?? (stored ? preferences.parse(stored) : defaults);
  const available = panels.map(({ id }) => id);
  const known = display.known ?? defaults.known ?? defaults.order;
  display.order = [
    ...new Set([...display.order, ...available.filter((id) => !known.includes(id))]),
  ];
  display.known = [...new Set([...known, ...available])];
  display.arranged ??= defaults.arranged;
  pages.set(route, display);
  if (!cached && stored?.panels) restorePanelColors(stored.panels, panels, title);
}

function readPage(route: string) {
  return (
    read(pageKey(route), storedPreferences) ??
    (route === '/plan/' ? read(legacyKey, storedPreferences) : undefined)
  );
}

function restorePanelColors(
  previous: Partial<Record<PanelId, Palette>>,
  panels: ReadonlyArray<{ id: PanelId; label: string }>,
  title: string,
) {
  const base = findColorScheme('previous-site')?.colors ?? appColors;
  for (const [panel, overrides] of Object.entries(previous)) {
    if (!overrides || !Object.keys(overrides).length) continue;
    const id = `previous:${page}:${panel}`;
    const label = panels.find((entry) => entry.id === panel)?.label ?? panel;
    saveColorScheme({
      id,
      name: `Previous ${title} · ${label}`,
      colors: { ...base, ...overrides },
    });
    display.panelSchemes[panel as PanelId] = id;
  }
  saveDisplay();
}

export function saveDisplay(value = display) {
  display = value;
  pages.set(page, value);
  write(pageKey(page), value);
}

export function panelRegion(settings: Preferences, id: PanelId) {
  return Math.min(settings.layout - 1, settings.layouts[settings.layout].regions[id] ?? 0);
}
