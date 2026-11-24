import { previewRows } from './composer.ts';
import { showInspector } from './inspector.ts';
import { responseView } from './json-view.ts';
import { findQuestion } from './questions.ts';
import {
  data,
  inspector,
  displayedRows,
  operationGroups,
  expandedGroups,
  requireValue,
} from './model.ts';
import type { EventRow, ArtifactRef, Stats, ToolCall } from './model.ts';
import {
  tokenCount,
  tokenPair,
  cacheRate,
  noData,
  commitReferences,
  escape,
  icon,
  pill,
  status,
  panel,
  readouts,
} from './view.ts';

export function inspect(row: EventRow, opener: HTMLButtonElement) {
  const tool = data.tools[row[4]];
  showInspector(opener, tool ? tool[0] : row[2], () => {
    inspector.tool = tool ?? null;
    return tool ? operationContent(tool) : responseView(row[3]);
  });
}

function operationContent(tool: ToolCall) {
  const [, component, activity, time, refused, input, output, flags] = tool;
  const providerOnly = Boolean(flags & 4);
  const subtext = providerOnly
    ? 'Codex recorded a transport error before ArcNexus received the call.'
    : 'The retained response includes the MCP transport envelope.';
  return `<div class="arc-row">
    ${status(providerOnly ? 'Provider error' : refused ? 'Refused' : 'Completed')}
    <small>${escape(component + ' / ' + activity + ' · ' + time + ' ET')}</small>
  </div>
  <div class="arc-inspect-grid">
    ${payloadPane('Input', data.payloads[input], Boolean(flags & 1), 'request', artifactPath(tool[8], providerOnly))}
    ${payloadPane('Output', data.payloads[output], Boolean(flags & 2), 'response', artifactPath(tool[9], providerOnly))}
  </div>
  <small>${subtext}</small>`;
}

export function artifactPath([folder, file]: ArtifactRef, providerOnly: boolean) {
  return (
    data.artifactRoot +
    data.directories[folder] +
    '/' +
    file +
    (providerOnly ? '' : '-mcp-observation.json')
  );
}

export function payloadPane(
  title: string,
  value: unknown,
  clipped: boolean,
  phase: string,
  path: string,
) {
  const host = !((inspector.tool?.[7] ?? 0) & 4);
  return `<section class="arc-payload-pane">
    <div class="arc-row"><h3>${title}</h3>${clipped ? pill('Excerpt', 'quiet') : ''}</div>
    <pre class="arc-payload" data-payload="${phase}">${escape(prettyPayload(value))}</pre>
    <details><summary>Retained ${phase}</summary>
      <input class="arc-payload-path" aria-label="Retained ${phase} path" readonly value="${escape(path)}">
      ${
        host
          ? `<label class="arc-file-picker">Open complete ${phase}
        <input type="file" accept=".json,application/json" data-artifact="${phase}">
      </label><small role="status"></small>`
          : ''
      }
    </details>
  </section>`;
}

export function prettyPayload(value: unknown) {
  return value == null
    ? 'Unavailable in this record.'
    : typeof value === 'string'
      ? value
      : (JSON.stringify(value, null, 2) ?? 'Unavailable');
}

export async function openArtifact(field: HTMLInputElement) {
  const tool = inspector.tool;
  const file = field.files?.[0];
  if (!tool || !file) return;
  const phase = field.dataset.artifact === 'request' ? 'request' : 'response';
  const pane = requireValue(field.closest('section'));
  const message = requireValue(pane.querySelector('[role="status"]'));
  const expected = artifactPath(tool[phase === 'request' ? 8 : 9], false)
    .split('/')
    .at(-1);
  try {
    if (file.name !== expected) throw new Error(`Choose the retained ${phase} shown above.`);
    const original = JSON.parse(await file.text());
    if (tool !== inspector.tool) return;
    const value = artifactPayload(original, tool[0], phase);
    requireValue(pane.querySelector('.arc-payload')).textContent = prettyPayload(value);
    pane.querySelector('.arc-pill')?.remove();
    message.textContent = `Complete retained ${phase} loaded.`;
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : String(error);
  }
}

function artifactPayload(
  original: { name?: string; phase?: string; args?: unknown; result?: unknown },
  name: string,
  phase: 'request' | 'response',
) {
  const valid =
    phase === 'request'
      ? original.phase === 'started'
      : original.phase === 'completed' || original.phase === 'refused';
  if (original.name !== name || !valid)
    throw new Error('This artifact does not match the selected operation.');
  return phase === 'request' ? original.args : original.result;
}

export function toolCounts(rows: EventRow[]) {
  const counts = new Map<string, number>();
  let providerOnly = 0;
  for (const row of rows) {
    const call = data.tools[row[4]];
    if (!call) continue;
    if (call[7] & 4) providerOnly++;
    const name = call[0];
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return {
    report: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    providerOnly,
  };
}

export function countDetails(counts: { report: [string, number][]; providerOnly: number }) {
  if (!counts.report.length) return '';
  return (
    '<details class="arc-tool-counts"><summary>Tools by frequency</summary>' +
    readouts(
      counts.report.map(([name, count]) => [name, tokenCount(count)]),
      'arc-tool-rows',
    ) +
    (counts.providerOnly
      ? '<small>' + counts.providerOnly + ' provider transport errors had no host receipt.</small>'
      : '') +
    '</details>'
  );
}

export function metrics(name: string, values: Stats, rows: EventRow[] = [], elapsed?: string) {
  const items: [string, string][] = [
    ['State', status(values.state)],
    ['Last updated (ET)', escape(values.last)],
    ['Codex execution time', escape(values.nativeDuration)],
    ['Reported tokens (in / out)', tokenPair(values.input, values.output)],
    ['Token cache rate', cacheRate(values.input, values.cached)],
  ];
  if (elapsed) items.splice(2, 0, ['Phase elapsed time', escape(elapsed)]);
  const counts = toolCounts(rows);
  const total = counts.report.reduce((sum, [, count]) => sum + count, 0);
  if (rows.length)
    items.push([
      name === 'Planner' || name === 'Architect' ? 'Phase tool calls' : 'Tool calls',
      tokenCount(total),
    ]);
  const timing = elapsed
    ? `<details class="arc-timing"><summary>How time is measured</summary>
      <p>Phase elapsed time covers the whole workflow, including any approval waits, review and delivery. Codex execution time totals invocation time for ${escape(name)}, including tools used during those invocations.</p></details>`
    : '';
  const details = timing + countDetails(counts);
  return panel(name + ' metrics', readouts(items) +
    (details ? '<div class="arc-metric-details">' + details + '</div>' : ''));
}

export function timelineItem(row: EventRow) {
  const [time, kind, label, , seq] = row;
  const tool = data.tools[seq];
  const response = kind === 'response';
  const glyph = tool ? 'terminal' : kind === 'lifecycle' ? 'activity' : 'message-square';
  const heading =
    tool || response
      ? '<button class="arc-log-open" type="button" data-inspect="' +
        seq +
        '" aria-haspopup="dialog">' +
        escape(label) +
        icon('chevron-right') +
        '</button>'
      : '<h3>' + escape(label) + '</h3>';
  return (
    '<span class="arc-symbol">' +
    icon(glyph) +
    '</span><div>' +
    heading +
    timelineText(row) +
    '</div><time>' +
    escape(time) +
    '</time>'
  );
}

export function timelineText(row: EventRow) {
  const [, kind, , detail, sequence] = row;
  if (kind === 'response') return '<p>Structured reply · Open to read</p>';
  if (kind === 'question') {
    const question = findQuestion(String(sequence));
    const prompt = question?.prompt ?? detail.split('\n\n')[0];
    const label = question?.answer ? 'View answered question' : 'Open question';
    return (
      '<p>' +
      commitReferences(prompt) +
      '</p>' +
      (question ? `<button type="button" class="arc-button" data-question="${escape(question.id)}">${label}</button>` : '')
    );
  }
  return detail
    ? '<p class="' +
        (kind === 'message' || kind === 'preview' ? 'arc-message-text' : '') +
        '">' +
        commitReferences(detail) +
        '</p>'
    : '';
}

export function timelineGroups(rows: EventRow[]) {
  const groups: { row: EventRow | null; calls: EventRow[] }[] = [];
  for (const row of rows) {
    if (!data.tools[row[4]]) groups.push({ row, calls: [] });
    else {
      if (!groups.length) groups.push({ row: null, calls: [] });
      requireValue(groups.at(-1)).calls.push(row);
    }
  }
  return groups;
}

export function groupCalls(calls: EventRow[]) {
  const key = String(requireValue(calls[0])[4]);
  operationGroups.set(key, calls);
  const expanded = expandedGroups.has(key);
  return (
    '<details class="arc-tool-group" data-tool-group="' +
    key +
    '"' +
    (expanded ? ' open' : '') +
    '><summary>' +
    tokenCount(calls.length) +
    (calls.length === 1 ? ' tool call' : ' tool calls') +
    '</summary><ol class="arc-timeline">' +
    (expanded ? renderCalls(calls) : '') +
    '</ol></details>'
  );
}

export function renderCalls(calls: EventRow[]) {
  return calls.map((row) => '<li>' + timelineItem(row) + '</li>').join('');
}

export function eventLogPane(name: string, rows: EventRow[], preview = true) {
  return {
    id: 'arc-event-log' as const,
    label: 'Event log',
    content: (action: string) => eventLog(name, rows, preview, action),
  };
}

function eventLog(
  name: string,
  rows: EventRow[],
  preview: boolean,
  action: string,
) {
  const header = `<div class="arc-row"><small>Times in ET</small>${action}</div>`;
  const input = preview ? rows.concat(previewRows()) : rows;
  if (!input.length)
    return panel(name + ' event log', noData('No matching events in the retained scope.'), header);
  for (const row of input) displayedRows.set(String(row[4]), row);
  const timeline = timelineGroups(input)
    .map(
      ({ row, calls }) =>
        '<li class="arc-log-group">' +
        (row ? '<div class="arc-log-item">' + timelineItem(row) + '</div>' : '') +
        (calls.length ? groupCalls(calls) : '') +
        '</li>',
    )
    .join('');
  return panel(
    name + ' event log',
    '<ol class="arc-timeline arc-grouped-log">' + timeline + '</ol>',
    header,
    false,
  );
}
