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

const githubRepository = 'https://github.com/fractalsynapse/arcnexus';
const isCommitRef = /^[0-9a-f]+$/i;
let capturedCommitRefs: Set<string> | undefined;

export function commitReference(ref?: string | null, label = ref || 'Unavailable') {
  return ref && isCommitRef.test(ref)
    ? `<a class="arc-commit-link" href="${githubRepository}/commit/${ref}" target="_blank" rel="noopener noreferrer">${escape(label)}</a>`
    : escape(label);
}

function collectCommitRefs() {
  const refs = new Set<string>();
  const add = (ref?: string) => {
    if (!ref || !isCommitRef.test(ref)) return;
    refs.add(ref.toLowerCase());
    refs.add(asText(ref).toLowerCase());
  };
  for (const file of data.files) {
    add(file.capture);
    for (const revision of file.revisions) add(revision.id);
  }
  for (const goal of data.goals) {
    add(goal.delivery.commit);
    add(goal.delivery.publication?.head);
    add(goal.delivery.publication?.parent);
    for (const snapshot of goal.snapshots) add(snapshot.capturedRevision);
    for (const activation of goal.activations) add(activation.revision);
    for (const receipt of goal.receipts) {
      add(receipt.base);
      add(receipt.head);
    }
  }
  return refs;
}

export function commitReferences(text = '') {
  const refs = (capturedCommitRefs ??= collectCommitRefs());
  return escape(text).replace(/\b[0-9a-f]+\b/gi, (ref) =>
    refs.has(ref.toLowerCase()) ? commitReference(ref) : ref,
  );
}

export function githubReferences(text: string) {
  return commitReferences(text).replace(
    /\b(PR|issue)\s+#(\d+)\b/gi,
    (label, kind, number) =>
      '<a class="arc-link" href="' + githubRepository + '/' +
      (kind.toLowerCase() === 'pr' ? 'pull' : 'issues') +
      '/' +
      number +
      '" target="_blank" rel="noopener noreferrer">' +
      label +
      '</a>',
  );
}

export function githubOutcome(
  kind: 'Issue' | 'PR',
  number: string,
  observedState?: string,
  count?: number,
) {
  const link = githubReferences(kind + ' #' + number);
  const ended = observedState === 'closed' || observedState === 'merged';
  const label = observedState
    ? observedState.charAt(0).toUpperCase() + observedState.slice(1) : 'State unavailable';
  const unit = kind === 'Issue' ? 'comment' : 'commit';
  const quantity = count === undefined
    ? unit + ' count unavailable' : tokenCount(count) + ' ' + unit + (count === 1 ? '' : 's');
  return `<div class="arc-row arc-github-reference">
    ${ended ? '<s>' + link + '</s>' : link}
    ${status(label)}<small>${escape(quantity)}</small></div>`;
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
  const meta = description ? '<p>' + commitReferences(description) + '</p>' : '';
  const context = action ? '<div class="arc-title-context">' + action + '</div>' : '';
  return '<div class="arc-title"><div class="arc-title-text"><h1 tabindex="-1">' + escape(name) +
    '</h1>' + meta + '</div>' + context + '</div>';
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
    '<ul class="arc-facts">' + items.map((item) => `<li>${commitReferences(item)}</li>`).join('') + '</ul>'
  );
}
