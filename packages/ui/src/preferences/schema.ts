import { z } from 'zod';
import { columnCounts, fullWidthRegions } from '../layouts/panels/presets/index.js';

const color = z.string().regex(/^#[\da-f]{6}$/i);
const palette = z.strictObject({ background: color, text: color, accent: color });
const scheme = z.strictObject({ id: z.string(), name: z.string(), colors: palette });

export const pagePreferencesSchema = z.strictObject({
  columns: z.literal(columnCounts),
  order: z.array(z.string()),
  hidden: z.array(z.string()),
  regions: z.record(z.string(), z.union([z.number().int().nonnegative(), z.enum(fullWidthRegions)])),
  widths: z.array(z.number().positive()),
});

export const themePreferencesSchema = z.strictObject({ selected: z.string(), schemes: z.array(scheme) });

const preferenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('site'), selected: z.string() }),
  z.strictObject({ kind: z.literal('scheme'), scheme }),
  z.strictObject({ kind: z.literal('layout'), workspace: z.string(), layout: pagePreferencesSchema }),
  z.strictObject({ kind: z.literal('display'), workspace: z.string(), panel: z.string(), selected: z.string() }),
]);

export const uiPreferencesResource = 'ui-preferences';
export const preferencesSnapshot = z.strictObject({ entries: z.array(preferenceSchema) });
export const preferencesUpdate = preferencesSnapshot.extend({ preserveExisting: z.boolean().optional() });

export type Palette = z.infer<typeof palette>;
export type Scheme = z.infer<typeof scheme>;
export type PagePreferences = z.infer<typeof pagePreferencesSchema>;
export type UiPreference = z.infer<typeof preferenceSchema>;
export type PreferencesSnapshot = z.infer<typeof preferencesSnapshot>;

/** Identify independent operator settings so changes to one do not overwrite another. */
export function preferenceKey(preference: UiPreference) {
  switch (preference.kind) {
    case 'site': return 'site';
    case 'scheme': return JSON.stringify(['scheme', preference.scheme.id]);
    case 'layout': return JSON.stringify(['layout', preference.workspace]);
    case 'display': return JSON.stringify(['display', preference.workspace, preference.panel]);
  }
}
