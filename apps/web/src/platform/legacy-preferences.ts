import {
  pagePreferencesSchema,
  preferencesSnapshot,
  themePreferencesSchema,
  type UiPreference,
} from '../../../../packages/ui/src/preferences/schema.js';

const layoutPrefix = 'arcnexus.web.layout:';
const displayPrefix = 'arcnexus.web.panel:';

/** Read the original browser settings once when the operator has no saved settings. */
export function legacyPreferences(): UiPreference[] {
  try {
    const theme = themePreferencesSchema.safeParse(
      parse(localStorage.getItem('arcnexus.web.theme')),
    );
    const entries: UiPreference[] = theme.success
      ? [
          { kind: 'site', selected: theme.data.selected },
          ...theme.data.schemes.map((scheme) => ({ kind: 'scheme' as const, scheme })),
        ]
      : [];
    return entries.concat(Object.keys(localStorage).flatMap(readSetting));
  } catch {
    return [];
  }
}

function readSetting(key: string): UiPreference[] {
  if (key.startsWith(layoutPrefix)) {
    const layout = pagePreferencesSchema.safeParse(parse(localStorage.getItem(key)));
    return layout.success
      ? [{ kind: 'layout', workspace: key.slice(layoutPrefix.length), layout: layout.data }]
      : [];
  }
  if (!key.startsWith(displayPrefix)) return [];
  const scope = parse(key.slice(displayPrefix.length));
  if (!Array.isArray(scope)) return [];
  const [workspace, panel] = scope;
  const parsed = preferencesSnapshot.safeParse({
    entries: [{ kind: 'display', workspace, panel, selected: localStorage.getItem(key) }],
  });
  return parsed.success ? parsed.data.entries : [];
}

function parse(value: string | null): unknown {
  try {
    return JSON.parse(value ?? 'null');
  } catch {
    return undefined;
  }
}
