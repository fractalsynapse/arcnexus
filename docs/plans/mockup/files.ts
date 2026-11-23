import { phaseActor, phaseRows } from './composer.ts';
import { componentReadout } from './component-form.ts';
import { diffView, draftDiff } from './diff.ts';
import { showInspector } from './inspector.ts';
import { markdownContent } from './markdown.ts';
import { overview, splitPanels } from './panels.ts';
import type { Pane } from './panels.ts';
import { data, files, state, requireValue, dom, root, fileArea, inspector } from './model.ts';
import type { Area, DesignFile, IndexedFile, Revision, Filter, Phase } from './model.ts';
import { hasYamlForm } from './yaml-schema.ts';
import { fileName } from './file-topics.ts';
import { fileTopics, filterTopics, topicKey } from './topic-picker.ts';
import { metrics, eventLogPane } from './timeline.ts';
import { ogsmGoalFile } from './ogsm-example.ts';
import {
  commitReferences,
  githubReferences,
  githubOutcome,
  roundStatus,
  noData,
  escape,
  icon,
  pill,
  options,
  panel,
  readouts,
  shortCommitReference,
  title,
  breadcrumbs,
  icons,
} from './view.ts';

export function phaseOutcome(phase: Area) {
  if (phase === 'plan') return plannerOutcome();
  const paragraphs = data.architect.detail.split('\n\n');
  return (
    phaseReferences(data.architect) +
    '<p>' +
    commitReferences(paragraphs[0]) +
    '</p>' +
    (paragraphs.length > 1
      ? '<details><summary>Assessment rationale</summary>' +
        paragraphs
          .slice(1)
          .map((paragraph) => '<p>' + commitReferences(paragraph) + '</p>')
          .join('') +
        '</details>'
      : '')
  );
}

function plannerOutcome() {
  const plan = data.plan;
  return `${phaseReferences(plan)}<p>${githubReferences(plan.detail.replace(/^PR #\d+ merged the /, 'Merged the '))} ${plan.modified.length}
    ${plan.modified.length === 1 ? 'file changed.' : 'files changed.'}</p>`;
}

function phaseReferences(phase: Phase) {
  const number = phase.pr?.split('/').at(-1);
  if (!phase.issue && !number) return '';
  const prState = phase.prState ?? (phase.stats.state === 'Merged' ? 'merged' : undefined);
  return `<div class="arc-github-outcome">
    ${phase.issue ? githubOutcome('Issue', phase.issue, phase.issueState, phase.issueComments) : ''}
    ${number ? githubOutcome('PR', number, prState, phase.prCommits) : ''}
  </div>`;
}

export function workspaceIndex(area: Area) {
  const name = phaseActor(area).role;
  const phase = data[area];
  const rows = phaseRows(area);
  const outcome = panel(name + ' outcome', phaseOutcome(area));
  return (
    title(area === 'plan' ? 'Plan' : 'Architect', '', roundStatus()) +
    overview(
      metrics(name, phase.stats, phase.rows, phase.wall),
      outcome,
      { log: eventLogPane(name, rows), context: fileIndex(area) },
    )
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

function fileIndex(area: Area): Pane {
  return {
    id: 'arc-files',
    label: 'Files',
    content: (action) => `<div class="arc-files-wrap">${panel(
      'Files', fileIndexContents(area), `<div class="arc-row"><small class="arc-file-count"></small>${action}</div>`, false,
    )}</div>`,
  };
}

function fileIndexContents(area: Area) {
  const filter = state.filters[area];
  const order: [string, string][] = [
    ['priority', 'Priority'],
    ['updated', 'Last updated'],
    ['name', 'Name'],
  ];
  return `<div class="arc-filter">
    <label>File type<select data-change="filter-type">${options(fileTypes(area), filter.type)}</select></label>
    <label>Sort by<select data-change="filter-sort">${options(order, filter.sort)}</select></label>
    <label class="wide">Search<input type="search" data-filter="search" placeholder="Search file name and content" value="${escape(filter.query)}"></label>
    <div class="wide">${filterTopics()}</div>
    <label class="wide arc-checkbox"><input type="checkbox" data-change="filter-changed"
      ${filter.changed ? 'checked' : ''}>Changed only</label>
  </div>
  <div class="arc-file-row arc-table-head">
    <span>Name</span><span>Priority</span><span class="arc-topics-head">Topics</span><span>Updated</span><span></span>
  </div>
  <div class="arc-file-list"></div>`;
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
      latest.topics.some((value) => topicKey(value) === topicKey(topic)),
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

function fileDescription({ area, type, latest }: IndexedFile) {
  if (area === 'architect') {
    const heading = latest.content.match(/^ *# (.+)$/m)?.[1];
    const description = latest.content.match(/^description: +(.+)$/m)?.[1];
    return description || heading || latest.name;
  }
  if (type !== 'Objective' || !latest.name.startsWith('Human objective ·')) return latest.name;
  const exact = latest.content.match(/## Exact submission\s*```text\s*([\s\S]*?)\n```/)?.[1];
  return exact?.split('\n\n')[0] ?? latest.name;
}

export function fileRow(item: IndexedFile) {
  const { id, latest, path, area } = item;
  const description = escape(fileDescription(item));
  const changed = (area === 'plan' ? data.plan : data.architect).modified.includes(path);
  const topics = latest.topics.length
    ? latest.topics.map((topic) => pill(topic, 'quiet')).join('')
    : '<span class="arc-muted">—</span>';
  return (
    '<button type="button" class="arc-file-row' +
    (changed ? ' is-changed' : '') +
    '" data-file="' +
    id +
    '" data-arc-tooltip="' + description + '" aria-describedby="arc-description-' + id + '"><span class="arc-file-name">' +
    icon('file-text') +
    '<span class="arc-file-label"><span class="arc-mono">' + escape(fileName(path)) + '</span>' +
    '<span class="arc-sr" id="arc-description-' + id + '">' + description + '</span>' +
    fileFormat(item) +
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

function fileFormat(item: DesignFile) {
  const name = fileName(item.path);
  const collision = files.some((other) => other.area === item.area && other.type === item.type &&
    other.path !== item.path && fileName(other.path) === name);
  return collision ? '<small>' + (item.path.endsWith('.md') ? 'Markdown' : 'YAML') + '</small>' : '';
}

export function fileDiff(item: DesignFile, index: number, action = '') {
  const current = requireValue(item.revisions[index]);
  const previous = item.revisions[index + 1];
  if (!previous)
    return panel('Changes', noData('No earlier revision included in this snapshot.'), action);
  const label = 'Compared with ' + previous.id;
  const lines = revisionDiff(current, previous);
  return lines.length
    ? diffView(label, [{ path: item.path, lines }], { action })
    : panel(
        'Changes',
        noData('Contents match the selected comparison.'),
        `<div class="arc-row"><small>${commitReferences(label)}</small>${action}</div>`,
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
  const metadata = `<div class="arc-form-grid">
    ${editInput('Name', 'name', rev.name, !state.editing)}
    ${editInput('Priority', 'priority', rev.priority, !state.editing, 'number')}
    ${fileTopics(rev, state.editing)}
  </div>`;
  return (
    fileBreadcrumbs(item) + title(rev.name) +
    `<small class="arc-file-reference"><code class="arc-file-path">${escape(item.path)}</code></small>
    <form class="arc-stack" data-form="file">
      ${fileRevisionControls(item)}
      ${panel('File information', metadata)}
      ${filePanels(item, rev)}
    </form>`
  );
}

function fileBreadcrumbs(item: DesignFile) {
  const area = item.area === 'plan' ? 'Plan' : 'Architect';
  const trail = breadcrumbs(data.fileReview ? [[area + ' file']] : [[area, `/${item.area}/`], ['File']]);
  return `<div class="arc-file-crumb-row">${trail}
    <button type="button" class="arc-link arc-file-git" data-action="file-git" aria-label="Git information"
      aria-haspopup="dialog" data-arc-tooltip="Git information">${icon('info')}</button></div>`;
}

export function openFileGitInformation(opener: HTMLButtonElement) {
  const item = files[state.fileId];
  const revision = item?.revisions[state.revision];
  if (!item || !revision) return;
  showInspector(opener, 'Git information', () => {
    inspector.tool = null;
    return readouts([
      ['File type', escape(item.type)],
      ['File revision', shortCommitReference(revision.id)],
      ['Repository capture', item.capture ? shortCommitReference(item.capture) : 'Unavailable'],
    ]);
  }, { compact: true });
}

function filePanels(item: DesignFile, revision: Revision) {
  return splitPanels({
    id: 'arc-file-content',
    label: 'Content',
    content: (action) => panel('Content', fileContent(item, revision), action),
  }, {
    id: 'arc-file-changes',
    label: 'Changes',
    content: (action) => state.editing && hasYamlForm(item)
      ? panel('Changes', '<div data-yaml-changes></div>', `<div class="arc-row"><small>Draft vs selected revision</small>${action}</div>`)
      : fileDiff(item, state.revision, action),
  });
}

function fileRevisionControls(item: DesignFile) {
  const currentLabel = item === ogsmGoalFile ? 'Preview revision' : 'Selected capture';
  const choices: [string, string][] = item.revisions.map((rev, index) => [
    String(index),
    rev.id + ' · ' + (index === 0 ? currentLabel : rev.updated),
  ]);
  const progress = item.type === 'Goal'
    ? `<button type="button" class="arc-button" data-action="goal-progress" aria-haspopup="dialog">${icon('chart-no-axes-column')}Progress</button>`
    : '';
  return `<div class="arc-detail-toolbar">
    <label>File revision<select data-change="file-revision">${options(choices, String(state.revision))}</select></label>
    <div class="arc-row">
      ${progress}
      ${state.saved ? '<span class="arc-pill" role="status">Draft revision saved in preview</span>' : ''}
      ${state.editing && hasYamlForm(item) ? '<small class="arc-yaml-error" data-yaml-save-status role="status"></small>' : ''}
      <label class="arc-checkbox"><input type="checkbox" data-change="edit" ${state.editing ? 'checked' : ''}
        ${state.revision === 0 ? '' : 'disabled'}>Edit</label>
      ${state.editing ? '<button type="button" data-action="apply-form" class="arc-button solid">Save</button>' : ''}
    </div>
  </div>`;
}

function fileContent(item: DesignFile, rev: Revision) {
  if (item.path.endsWith('.md')) return markdownContent(rev.content, state.editing);
  if (state.editing && hasYamlForm(item)) return '<div class="arc-yaml-edit" data-yaml-editor></div>';
  if (state.editing)
    return `<label><span class="arc-sr">File content</span>
    <textarea name="content" class="arc-content-edit" required>${escape(rev.content)}</textarea></label>`;
  const yaml = `<div class="arc-markdown arc-code-view"><pre><code class="language-yaml">${escape(rev.content)}</code></pre></div>`;
  const prose = item.type === 'Component' ? componentReadout(rev.content) : '';
  return prose
    ? `<div class="arc-stack">${prose}<details class="arc-yaml-disclosure"><summary>Raw YAML</summary>
      <div class="arc-yaml-section-body">${yaml}</div></details></div>`
    : yaml;
}
