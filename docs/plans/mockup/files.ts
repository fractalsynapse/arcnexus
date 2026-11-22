import { plannerRows } from './composer.ts';
import { diffView } from './diff.ts';
import { markdownContent } from './markdown.ts';
import { data, files, state, requireValue, dom, root, fileArea } from './model.ts';
import type { Area, DesignFile, IndexedFile, Revision, Filter, FilePane } from './model.ts';
import { fileName } from './plan-topics.ts';
import { metrics, eventLog } from './timeline.ts';
import {
  asText,
  githubReferences,
  roundStatus,
  noData,
  escape,
  icon,
  pill,
  options,
  panel,
  title,
  breadcrumbs,
  icons,
} from './view.ts';

export function phaseOutcome(phase: Area) {
  if (phase === 'plan') return plannerOutcome();
  const paragraphs = data.architect.detail.split('\n\n');
  return (
    '<p>' +
    escape(paragraphs[0]) +
    '</p>' +
    (paragraphs.length > 1
      ? '<details><summary>Assessment rationale</summary>' +
        paragraphs
          .slice(1)
          .map((paragraph) => '<p>' + escape(paragraph) + '</p>')
          .join('') +
        '</details>'
      : '')
  );
}

function plannerOutcome() {
  const plan = data.plan;
  const number = plan.pr?.split('/').at(-1);
  const prState = plan.prState ?? (plan.stats.state === 'Merged' ? 'merged' : undefined);
  return `<div class="arc-github-outcome">
    ${plan.issue ? outcomeReference('Issue', plan.issue, plan.issueState, plan.issueComments, 'comment') : ''}
    ${number ? outcomeReference('PR', number, prState, plan.prCommits, 'commit') : ''}
  </div><p>${githubReferences(plan.detail.replace(/^PR #\d+ merged the /, 'Merged the '))} ${plan.modified.length}
    ${plan.modified.length === 1 ? 'file changed.' : 'files changed.'}</p>`;
}

function outcomeReference(kind: string, number: string, state: string | undefined, count: number | undefined, unit: string) {
  const link = githubReferences(kind + ' #' + number);
  const ended = state === 'closed' || state === 'merged';
  const label = state ? state[0]?.toUpperCase() + state.slice(1) : 'State unavailable';
  const quantity = count === undefined ? unit + ' count unavailable' : count + ' ' + unit + (count === 1 ? '' : 's');
  return `<div class="arc-row">${ended ? '<s>' + link + '</s>' : link}
    ${pill(label)}<small>${escape(quantity)}</small></div>`;
}

export function workspaceIndex(area: Area) {
  const name = area === 'plan' ? 'Planner' : 'Architect';
  const phase = data[area];
  const rows = area === 'plan' ? plannerRows(phase.rows) : phase.rows;
  return (
    title(area === 'plan' ? 'Plan' : 'Architect', '', roundStatus()) +
    `<div class="arc-grid arc-index">
      <div class="arc-stack">
        <div class="arc-metrics-wrap">${metrics(name, phase.stats, phase.rows, phase.wall)}</div>
        <div class="arc-log-wrap">${eventLog(name, rows)}</div>
      </div>
      <div class="arc-stack">
        <div class="arc-outcome-wrap">${panel(name + ' outcome', phaseOutcome(area))}</div>
        <div class="arc-files-wrap">${fileIndex(area)}</div>
      </div>
    </div>`
  );
}

function fileTypes(area: Area): [string, string][] {
  return area === 'plan'
    ? [
        ['Goal', 'Goals'],
        ['Objective', 'Objectives'],
      ]
    : [
        ['Component', 'Components'],
        ['Standard', 'Standards'],
        ['Operation', 'Operations'],
      ];
}

function fileIndex(area: Area) {
  const filter = state.filters[area];
  const order: [string, string][] = [
    ['priority', 'Priority'],
    ['updated', 'Last updated'],
    ['name', 'Name'],
  ];
  return panel(
    'Files',
    `<div class="arc-filter">
    <label>File type<select data-change="filter-type">${options(fileTypes(area), filter.type)}</select></label>
    <label>Sort by<select data-change="filter-sort">${options(order, filter.sort)}</select></label>
    <label class="wide">Search<input type="search" data-filter="search" placeholder="Search file name and content" value="${escape(filter.query)}"></label>
    ${topicFilter(area, filter.topics)}
    <label class="wide arc-checkbox"><input type="checkbox" data-change="filter-changed"
      ${filter.changed ? 'checked' : ''}>Changed only</label>
  </div>
  <div class="arc-file-row arc-table-head">
    <span>Name</span><span>Priority</span><span class="arc-topics-head">Topics</span><span>Updated</span><span></span>
  </div>
  <div class="arc-file-list"></div>`,
    '<small class="arc-file-count"></small>',
    false,
  );
}

function topicFilter(area: Area, selected: string[]) {
  const topics = [
    ...new Set(
      files
        .filter((item) => item.area === area)
        .flatMap((item) => requireValue(item.revisions[0]).topics),
    ),
  ].sort();
  const chips = selected
    .map(
      (topic) => `<button type="button" class="arc-pill" data-topic="${escape(topic)}"
    aria-label="Remove topic ${escape(topic)}">${escape(topic)} ×</button>`,
    )
    .join('');
  return (
    `<form class="wide" data-form="topics">
    <label for="arc-topic-entry">Topics</label>
    <div class="arc-filter-pair">
      <input id="arc-topic-entry" name="topic" list="arc-topic-choices" placeholder="Add topics, separated by commas">
      <button class="arc-button" type="button" data-action="apply-form" aria-label="Add topics">+</button>
    </div>
    ${topics.length ? '' : '<small class="arc-empty-topics">Topics unavailable in captured files</small>'}
    <datalist id="arc-topic-choices">${topics.map((t) => `<option value="${escape(t)}"></option>`).join('')}</datalist>
  </form>` + (chips ? `<div class="arc-chips wide">${chips}</div>` : '')
  );
}

export function updateFileList() {
  const area = fileArea();
  const filter = state.filters[area];
  const list = root.querySelector('.arc-file-list');
  if (!list) return;
  const search = filter.query.trim().toLowerCase();
  const matches = files
    .map((item, id) => ({ ...item, id, latest: requireValue(item.revisions[0]) }))
    .filter((item) => matchesFile(item, area, filter, search))
    .sort((a, b) => compareFiles(a, b, filter.sort));
  dom('.arc-file-count').textContent = matches.length + (matches.length === 1 ? ' file' : ' files');
  list.innerHTML = matches.length
    ? matches.map(fileRow).join('')
    : '<p class="arc-body arc-muted">No files match these filters.</p>';
  icons();
}

export function matchesFile(item: IndexedFile, area: Area, filter: Filter, search: string) {
  const latest = item.latest;
  return (
    item.area === area &&
    item.type === filter.type &&
    (!filter.changed || data[area].modified.includes(item.path)) &&
    [fileName(item.path), fileDescription(item), latest.content].some((text) => text.toLowerCase().includes(search)) &&
    filter.topics.every((topic) =>
      latest.topics.some((value) => value.toLowerCase() === topic.toLowerCase()),
    )
  );
}

export function compareFiles(first: IndexedFile, second: IndexedFile, sort: string) {
  const a = first.latest;
  const b = second.latest;
  const priority = (a.priority ?? Infinity) - (b.priority ?? Infinity);
  const byName = fileName(first.path).localeCompare(fileName(second.path));
  if (sort === 'name') return byName;
  if (sort === 'priority') return priority || byName;
  return (
    Number(b.updated === 'Preview draft') - Number(a.updated === 'Preview draft') ||
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') ||
    priority ||
    byName
  );
}

function fileDescription({ type, latest }: IndexedFile) {
  if (type !== 'Objective' || !latest.name.startsWith('Human objective ·')) return latest.name;
  const exact = latest.content.match(/## Exact submission\s*```text\s*([\s\S]*?)\n```/)?.[1];
  return exact?.split('\n\n')[0] ?? latest.name;
}

export function fileRow(item: IndexedFile) {
  const { id, latest, path, area } = item;
  const changed = (area === 'plan' ? data.plan : data.architect).modified.includes(path);
  const topics = latest.topics.length
    ? latest.topics.map((topic) => pill(topic, 'quiet')).join('')
    : '<span class="arc-muted">—</span>';
  return (
    '<button type="button" class="arc-file-row' +
    (changed ? ' is-changed' : '') +
    '" data-file="' +
    id +
    '" aria-describedby="arc-description-' + id + '"><span class="arc-file-name">' +
    icon('file-text') +
    '<span class="arc-file-label"><span class="arc-mono" title="' + escape(fileDescription(item)) +
    '" data-tooltip="' + escape(fileDescription(item)) + '">' + escape(fileName(path)) + '</span>' +
    '<span class="arc-sr" id="arc-description-' + id + '">' + escape(fileDescription(item)) + '</span>' +
    (changed ? pill(area === 'plan' ? 'Changed in Plan' : 'Changed in Architect') : '') +
    '</span></span><span class="arc-mono">' +
    (latest.priority == null ? '—' : escape(latest.priority)) +
    '</span><span class="arc-chips">' +
    topics +
    '</span><time>' +
    escape(latest.updated) +
    '</time>' +
    icon('chevron-right') +
    '</button>'
  );
}

export function fileDiff(item: DesignFile, index: number, action = '') {
  const current = requireValue(item.revisions[index]);
  const previous = item.revisions[index + 1];
  const heading = item.area === 'plan' ? 'Changes' : 'File diff';
  if (!previous)
    return panel(heading, noData('No earlier revision included in this snapshot.'), action);
  const label = 'Compared with ' + previous.id;
  const lines = revisionDiff(current, previous);
  return lines.length
    ? diffView(label, [{ path: item.path, lines }], { heading, action })
    : panel(
        heading,
        noData('Contents match the selected comparison.'),
        `<div class="arc-row"><small>${escape(label)}</small>${action}</div>`,
      );
}

function revisionDiff(current: Revision, previous: Revision): [string, string][] {
  const lines: [string, string][] = [];
  for (const [before, after] of [
    [previous.name, current.name],
    [`Priority ${previous.priority ?? '—'}`, `Priority ${current.priority ?? '—'}`],
    [previous.topics.join(', '), current.topics.join(', ')],
  ] as const) {
    if (before !== after) lines.push(['removed', '− ' + before], ['added', '+ ' + after]);
  }
  const after = current.content.split('\n');
  if (previous.restore && !current.id.startsWith('Draft')) {
    for (const [start, end, replacement] of previous.restore) {
      lines.push(['hunk', `@@ Captured lines ${start + 1}–${Math.max(start + 1, end)}`]);
      replacement.forEach((line) => lines.push(['removed', '− ' + line]));
      after.slice(start, end).forEach((line) => lines.push(['added', '+ ' + line]));
    }
  } else if (previous.content !== current.content) {
    lines.push(...draftDiff(previous.content.split('\n'), after));
  }
  return lines;
}

function draftDiff(before: string[], after: string[]): [string, string][] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return [
    ['hunk', `@@ Draft changes from line ${start + 1}`],
    ...before.slice(start, oldEnd).map<[string, string]>((line) => ['removed', '− ' + line]),
    ...after.slice(start, newEnd).map<[string, string]>((line) => ['added', '+ ' + line]),
  ];
}

export function editInput(
  label: string,
  name: string,
  value: string | number | null,
  readOnly: boolean,
  type = 'text',
) {
  return (
    '<label>' +
    label +
    '<input name="' +
    name +
    '" type="' +
    type +
    '" value="' +
    escape(value) +
    '"' +
    (readOnly ? ' readonly' : name === 'name' ? ' required' : '') +
    '></label>'
  );
}

export function fileView() {
  const item = requireValue(files[state.fileId]);
  const rev = requireValue(item.revisions[state.revision]);
  const slug = '/' + item.area + '/';
  const areaName = item.area === 'plan' ? 'Plan' : 'Architect';
  const metadata = `<div class="arc-form-grid">
    ${editInput('Type', 'type', item.type, true)}
    ${editInput('Name', 'name', rev.name, !state.editing)}
    ${editInput('Priority', 'priority', rev.priority, !state.editing, 'number')}
    ${editInput('Topics', 'topics', rev.topics.join(', '), !state.editing)}
  </div>`;
  return (
    breadcrumbs([[areaName, slug], ['File']]) +
    title(rev.name, item.type + ' · ' + rev.id) +
    `<small class="arc-file-reference">
      <span>Path <code class="arc-file-path">${escape(item.path)}</code></span>
      <span>Captured at ${asText(item.capture)}</span>
    </small>
    <form class="arc-stack" data-form="file">
      ${fileRevisionControls(item)}
      ${panel('File information', metadata)}
      ${filePanels(item, rev)}
    </form>`
  );
}

function filePanels(item: DesignFile, revision: Revision) {
  if (item.area === 'architect') {
    const content = panel('YAML', fileContent(item, revision));
    return `<div class="arc-grid equal">${content}${fileDiff(item, state.revision)}</div>`;
  }
  const content = panel('Content', fileContent(item, revision), expandButton('content'));
  const changes = fileDiff(item, state.revision, expandButton('changes'));
  const expanded = state.expandedFilePane;
  return `<div class="arc-grid equal arc-file-workspace" ${expanded ? 'data-expanded' : ''}>
    <div data-file-pane-panel="content" id="arc-file-content" ${expanded === 'changes' ? 'hidden' : ''}>${content}</div>
    <div data-file-pane-panel="changes" id="arc-file-changes" ${expanded === 'content' ? 'hidden' : ''}>${changes}</div>
  </div>`;
}

function paneLabel(pane: FilePane, expanded: boolean) {
  return (expanded ? 'Collapse ' : 'Expand ') + (pane === 'content' ? 'Content' : 'Changes');
}

function expandButton(pane: FilePane) {
  const expanded = state.expandedFilePane === pane;
  const label = paneLabel(pane, expanded);
  return `<button type="button" class="arc-link arc-file-expand" data-expand-file="${pane}"
    aria-controls="arc-file-${pane}" aria-expanded="${expanded}" aria-label="${label}"
    data-tooltip="${label}">${icon(expanded ? 'minimize-2' : 'maximize-2')}</button>`;
}

export function expandFilePane(control: HTMLButtonElement) {
  const pane = control.dataset.expandFile;
  const workspace = control.closest('.arc-file-workspace');
  if (!workspace || (pane !== 'content' && pane !== 'changes')) return;
  const expanded = state.expandedFilePane !== pane;
  state.expandedFilePane = expanded ? pane : null;
  workspace.toggleAttribute('data-expanded', expanded);
  workspace.querySelectorAll<HTMLElement>('[data-file-pane-panel]').forEach((panel) => {
    panel.hidden = expanded && panel.dataset.filePanePanel !== pane;
  });
  const label = paneLabel(pane, expanded);
  control.setAttribute('aria-expanded', String(expanded));
  control.setAttribute('aria-label', label);
  control.setAttribute('data-tooltip', label);
  control.innerHTML = icon(expanded ? 'minimize-2' : 'maximize-2');
  icons();
}

function fileRevisionControls(item: DesignFile) {
  const choices: [string, string][] = item.revisions.map((rev, index) => [
    String(index),
    rev.id + (index === 0 ? ' · Selected capture' : ' · ' + rev.updated),
  ]);
  return `<div class="arc-detail-toolbar">
    <label>File revision<select data-change="file-revision">${options(choices, String(state.revision))}</select></label>
    <div class="arc-row">
      ${state.saved ? '<span class="arc-pill" role="status">Draft revision saved in preview</span>' : ''}
      <label class="arc-checkbox"><input type="checkbox" data-change="edit" ${state.editing ? 'checked' : ''}
        ${state.revision === 0 ? '' : 'disabled'}>Edit</label>
      ${state.editing ? '<button type="button" data-action="apply-form" class="arc-button solid">Save</button>' : ''}
    </div>
  </div>`;
}

function fileContent(item: DesignFile, rev: Revision) {
  if (item.area === 'plan') return markdownContent(rev.content, state.editing);
  if (state.editing)
    return `<label><span class="arc-sr">File content</span>
    <textarea name="content" class="arc-content-edit" required>${escape(rev.content)}</textarea></label>`;
  return `<details><summary>View captured YAML</summary><pre class="arc-diff">${escape(rev.content)}</pre></details>`;
}
