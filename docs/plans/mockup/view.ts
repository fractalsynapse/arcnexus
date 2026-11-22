import { data } from './model.ts';

export function tokenCount(value: number | null | undefined) {
  return value === null || value === undefined
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US').format(value);
}

export function measuredDuration(ms: number | null) {
  if (ms === null) return 'Unavailable';
  const rounded = Math.round(ms / 1000);
  return rounded >= 3600
    ? Math.floor(rounded / 3600) + 'h ' + Math.floor((rounded % 3600) / 60) + 'm'
    : rounded >= 60
      ? Math.floor(rounded / 60) + 'm ' + String(rounded % 60).padStart(2, '0') + 's'
      : rounded + 's';
}

export function localDate(iso?: string | null) {
  return iso
    ? new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(iso))
    : 'Unavailable';
}

export function asText(when?: string | null) {
  return when ? when.slice(0, 8) : 'Unavailable';
}

export function githubReferences(text: string) {
  return escape(text).replace(
    /\b(PR|issue)\s+#(\d+)\b/gi,
    (label, kind, number) =>
      '<a class="arc-link" href="https://github.com/fractalsynapse/arcnexus/' +
      (kind.toLowerCase() === 'pr' ? 'pull' : 'issues') +
      '/' +
      number +
      '" target="_blank" rel="noopener noreferrer">' +
      label +
      '</a>',
  );
}

export function thousand(value: number | null) {
  return value == null
    ? '—'
    : new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
        value / 1000,
      ) + 'K';
}

export function tokenPair(input: number | null, output: number | null) {
  return thousand(input) + ' / ' + thousand(output);
}

export function cacheRate(input: number | null, cached: number | null) {
  return input && cached != null ? ((cached / input) * 100).toFixed(1) + '%' : 'Unavailable';
}

export function outcomeName(kind?: string) {
  return (
    (
      {
        merged: 'Merged',
        satisfied: 'Satisfied',
        accepted: 'Approved',
        rejected: 'Changes requested',
        cancelled: 'Cancelled',
        failed: 'Failed',
        blocked: 'Blocked',
        planned: 'Planned',
      } as Record<string, string>
    )[kind ?? ''] || 'Unavailable'
  );
}

export function roundStatus() {
  return (
    '<div class="arc-round"><span><strong>Refinement round 1</strong> · ' +
    escape(data.round.started) +
    '–' +
    escape(data.round.ended.split(' · ')[1]) +
    ' ET</span>' +
    '<span><strong>' +
    data.round.wall +
    '</strong> wall time</span>' +
    pill('Round completed') +
    '</div>'
  );
}

export function readouts(items: [string, string][], classes = '') {
  return (
    '<dl class="arc-metrics ' +
    classes +
    '">' +
    items
      .map(([label, value]) => '<div><dt>' + escape(label) + '</dt><dd>' + value + '</dd></div>')
      .join('') +
    '</dl>'
  );
}

export function noData(message: string) {
  return '<p class="arc-muted">' + escape(message) + '</p>';
}

export function escape(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char,
  );
}

export function icon(name: string) {
  return '<i data-lucide="' + name + '" aria-hidden="true"></i>';
}

export function button(text: string, route: string, symbol: string, className = 'arc-button') {
  return (
    '<button type="button" class="' +
    className +
    '" data-go="' +
    route +
    '">' +
    (symbol ? icon(symbol) : '') +
    escape(text) +
    '</button>'
  );
}

export function pill(text: string, type = '') {
  return '<span class="arc-pill ' + type + '">' + escape(text) + '</span>';
}

export function status(text: string) {
  return pill(
    text,
    ['Active', 'Running'].includes(text)
      ? 'live'
      : [
            'Rejected',
            'Changes requested',
            'Checks failed',
            'Needs correction',
            'Cancelled',
            'Interrupted',
            'Hosted check failed',
          ].includes(text)
        ? 'action'
        : [
              'Waiting',
              'Idle',
              'Ready',
              'Pending',
              'Unavailable',
              'Inapplicable',
              'No verdict recorded',
            ].includes(text)
          ? 'quiet'
          : '',
  );
}

export function options(values: [string, string][], selected?: string) {
  return values
    .map(
      ([value, text]) =>
        '<option value="' +
        escape(value) +
        '"' +
        (value === selected ? ' selected' : '') +
        '>' +
        escape(text) +
        '</option>',
    )
    .join('');
}

export function panel(title: string, content: string, extra = '', wrapped = true) {
  return (
    '<section class="arc-surface"><div class="arc-panel-head"><h2>' +
    escape(title) +
    '</h2>' +
    extra +
    '</div>' +
    (wrapped ? '<div class="arc-body">' + content + '</div>' : content) +
    '</section>'
  );
}

export function title(name: string, description = '', action = '') {
  return (
    '<div class="arc-title"><div class="arc-title-text"><h1>' +
    escape(name) +
    '</h1>' +
    (description ? '<p>' + escape(description) + '</p>' : '') +
    '</div>' +
    action +
    '</div>'
  );
}

export function breadcrumbs(items: [string, string?][]) {
  return (
    '<nav class="arc-crumbs" aria-label="Breadcrumb">' +
    items
      .map(([name, path]) =>
        path
          ? button(name, path, '', 'arc-link')
          : '<span aria-current="page">' + escape(name) + '</span>',
      )
      .join(icon('chevron-right')) +
    '</nav>'
  );
}

export function tabs(focus: boolean, activity: boolean, path: string) {
  const left = path + 'focus/';
  const right = path + 'activities/';
  return (
    '<nav class="arc-tabs" aria-label="Detail view"><button type="button" data-go="' +
    left +
    '"' +
    (focus ? ' aria-current="page"' : '') +
    '>' +
    icon('focus') +
    'Focus</button><button type="button" data-go="' +
    right +
    '"' +
    (!focus ? ' aria-current="page"' : '') +
    '>' +
    icon(activity ? 'list-tree' : 'list-checks') +
    'Activities</button></nav>'
  );
}

export function icons() {
  (
    globalThis as {
      lucide?: { createIcons(options: { attrs: { width: number; height: number } }): void };
    }
  ).lucide?.createIcons({ attrs: { width: 16, height: 16 } });
}

export function factList(items: string[]) {
  return (
    '<ul class="arc-facts">' + items.map((item) => `<li>${escape(item)}</li>`).join('') + '</ul>'
  );
}
