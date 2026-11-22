import { currentGoal } from './run-context.ts';
import {
  target,
  previewRows,
  composerUI,
  enqueue,
  advanceQueue,
  submitComposer,
} from './composer.ts';
import { loadDiffPatch, navigateDiffTabs, selectDiffTab } from './diff.ts';
import { workspaceIndex, updateFileList, fileView, expandFilePane } from './files.ts';
import { editedMarkdown, formatMarkdown, highlightMarkdownCode, pasteMarkdown } from './markdown.ts';
import { openQuestion, questionView, rememberAnswer, submitAnswer } from './questions.ts';
import { openRoundMetrics, roundFooter } from './round.ts';
import {
  files,
  state,
  displayedRows,
  operationGroups,
  expandedGroups,
  requireValue,
  dom,
  root,
  main,
  launch,
  fileArea,
} from './model.ts';
import type { Workspace } from './model.ts';
import { runIndex, sectionDetail, actorLog, compPage, activityPage, deliveryPage } from './run.ts';
import { inspect, openArtifact, renderCalls, eventLog } from './timeline.ts';
import { icon, button, icons } from './view.ts';

export function workspace(): Workspace {
  return state.route.startsWith('/run/')
    ? 'run'
    : state.route.startsWith('/architect/')
      ? 'architect'
      : 'plan';
}

export function renderCommand(reset = false) {
  const detailPage = state.route.endsWith('/file/') || state.route === '/plan/question/';
  const headerAction = dom('.arc-header-action');
  headerAction.innerHTML = detailPage
    ? button('Back', '/' + workspace() + '/', 'arrow-left')
    : state.route === '/run/direction/log/'
      ? button('Director', '/run/direction/', 'arrow-left')
      : state.route === '/run/review/log/'
        ? button('Reviewer', '/run/review/', 'arrow-left')
        : '<button type="button" class="arc-button" data-action="refine">' +
          icon('refresh-cw') +
          'Refine</button>';
  composerUI(reset);
}

const routes: Record<string, () => string> = {
  '/plan/': () => workspaceIndex('plan'),
  '/plan/file/': fileView,
  '/plan/question/': questionView,
  '/architect/': () => workspaceIndex('architect'),
  '/architect/file/': fileView,
  '/run/': runIndex,
  '/run/direction/': () => sectionDetail('Direction'),
  '/run/direction/log/': () => actorLog('Direction'),
  '/run/component/focus/': () => compPage(true),
  '/run/component/activities/': () => compPage(false),
  '/run/activity/focus/': () => activityPage(true),
  '/run/activity/activities/': () => activityPage(false),
  '/run/review/': () => sectionDetail('Review'),
  '/run/review/log/': () => actorLog('Review'),
  '/run/delivery/': deliveryPage,
};

export function render(resetComposer = false) {
  const r = state.route;
  const area = workspace();
  root.querySelectorAll<HTMLButtonElement>('.arc-nav button').forEach((item) => {
    if (item.dataset.go === '/' + area + '/') item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  displayedRows.clear();
  operationGroups.clear();
  main.innerHTML = requireValue(routes[r])();
  highlightMarkdownCode(main);
  const added = previewRows();
  if (added.length && r !== '/plan/question/' && !main.querySelector('.arc-grouped-log')) {
    main.insertAdjacentHTML('beforeend', eventLog(requireValue(target()).role, added, false));
  }
  updateFileList();
  renderCommand(resetComposer);
  icons();
}

export function go(route: string) {
  state.route = route;
  state.expandedFilePane = null;
  state.editing = false;
  state.saved = false;
  render(true);
}

export function openFile(id: string) {
  state.fileId = Number(id);
  state.revision = 0;
  go('/' + requireValue(files[state.fileId]).area + '/file/');
}

export function handleClick(control: HTMLButtonElement) {
  const { go: route, file: id, component, activity, action, topic, question, inspect: record } =
    control.dataset;
  if (question) openQuestion(question);
  else if (record) {
    const row = displayedRows.get(record);
    if (row) inspect(row, control);
  } else if (route) go(route);
  else if (id !== undefined) openFile(id);
  else if (component) {
    state.component = component;
    state.milestone = '';
    state.activity = 'implementation';
    go('/run/component/focus/');
  } else if (activity) {
    state.activity = activity;
    go('/run/activity/focus/');
  } else if (topic) {
    const filter = state.filters[fileArea()];
    filter.topics = filter.topics.filter((value) => value !== topic);
    render();
  } else if (action) handleAction(control, action);
}

export function handleAction(control: HTMLButtonElement, action: string) {
  if (action === 'close-inspector') dom<HTMLDialogElement>('.arc-inspector').close();
  else if (action === 'round-metrics') openRoundMetrics(control);
  else if (action === 'apply-form') applyPreviewForm(requireValue(control.closest('form')));
  else if (action === 'refine') enqueue('refine', '');
  else if (action === 'advance-queue') advanceQueue();
}

export function parseTopics(value: unknown) {
  return [
    ...new Set(
      String(value)
        .split(',')
        .map((topic) => topic.trim())
        .filter(Boolean),
    ),
  ];
}

export function applyPreviewForm(form: HTMLFormElement) {
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  if (form === launch) {
    submitComposer(data);
    return;
  }
  if (form.dataset.form === 'question') {
    submitAnswer(form.dataset.question ?? '', String(data.get('question-reply') ?? '').trim());
    return;
  }
  if (form.dataset.form === 'topics') {
    const filter = state.filters[fileArea()];
    filter.topics = [...new Set([...filter.topics, ...parseTopics(data.get('topic'))])];
    render();
  }
  if (form.dataset.form !== 'file' || !state.editing) return;
  saveRevision(form, data);
}

function saveRevision(form: HTMLFormElement, data: FormData) {
  const item = requireValue(files[state.fileId]);
  const source = requireValue(item.revisions[state.revision]).content;
  const content = item.area === 'plan'
    ? editedMarkdown(source, requireValue(form.querySelector<HTMLElement>('[data-md-editor]')))
    : String(data.get('content'));
  item.revisions.unshift({
    id: 'Draft ' + (item.revisions.filter((r) => r.id.startsWith('Draft')).length + 1),
    name: String(data.get('name')).trim(),
    priority: data.get('priority') ? Number(data.get('priority')) : null,
    topics: parseTopics(data.get('topics')),
    content,
    updated: 'Preview draft',
  });
  state.revision = 0;
  state.editing = false;
  state.saved = true;
  render();
}

root.addEventListener('click', (event) => {
  const element = event.target;
  if (!(element instanceof Element)) return;
  const control = element.closest('button');
  if (!control || !root.contains(control)) return;
  if (control.getAttribute('role') === 'tab') selectDiffTab(control);
  else if (control.dataset.expandFile) expandFilePane(control);
  else if (control.dataset.mdCommand) formatMarkdown(control);
  else handleClick(control);
});

root.addEventListener('mousedown', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-md-command]')) {
    event.preventDefault();
  }
});

root.addEventListener('paste', pasteMarkdown);

root.addEventListener('drop', (event) => {
  if (event.target instanceof Element && event.target.closest('[data-md-editor]')) {
    event.preventDefault();
  }
});

root.addEventListener(
  'toggle',
  (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) return;
    const key = details.dataset.toolGroup;
    if (!key) return;
    if (!details.open) {
      expandedGroups.delete(key);
      return;
    }
    expandedGroups.add(key);
    requireValue(details.querySelector('ol')).innerHTML = renderCalls(
      operationGroups.get(key) ?? [],
    );
    icons();
  },
  true,
);

root.addEventListener('input', (event) => {
  const field = event.target;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) rememberAnswer(field);
  if (!(field instanceof HTMLInputElement) || field.dataset.filter !== 'search') return;
  state.filters[fileArea()].query = field.value;
  updateFileList();
});

function changeRun(value: string) {
  state.goal = value;
  state.runRevision = String(requireValue(currentGoal().snapshots[0]).seq);
  state.component = '';
  state.milestone = '';
}

function changeField(kind: string, field: HTMLSelectElement | HTMLInputElement): boolean {
  const value = field.value;
  if (kind === 'filter-type') state.filters[fileArea()].type = value;
  else if (kind === 'filter-sort') state.filters[fileArea()].sort = value;
  else if (kind === 'filter-changed' && field instanceof HTMLInputElement) {
    state.filters[fileArea()].changed = field.checked;
    updateFileList();
    return false;
  }
  else if (kind === 'run-goal') changeRun(value);
  else if (kind === 'run-revision') state.runRevision = value;
  else if (kind === 'milestone') state.milestone = value;
  else if (kind === 'file-revision') {
    state.revision = Number(value);
    state.editing = false;
    state.saved = false;
  } else if (kind === 'edit' && field instanceof HTMLInputElement) {
    state.editing = field.checked;
    state.saved = false;
  } else return false;
  return true;
}

root.addEventListener('change', (event) => {
  const field = event.target;
  if (!(field instanceof HTMLSelectElement || field instanceof HTMLInputElement)) return;
  if (field instanceof HTMLInputElement && field.dataset.artifact) {
    void openArtifact(field);
    return;
  }
  if (field instanceof HTMLInputElement && field.hasAttribute('data-patch-file')) {
    void loadDiffPatch(field);
    return;
  }
  if (field.name === 'operation' && field.form === launch) {
    composerUI();
    return;
  }
  const kind = field.dataset.change;
  if (!kind || !changeField(kind, field)) return;
  render();
  root.querySelector<HTMLElement>('[data-change="' + kind + '"]')?.focus({ preventScroll: true });
});

root.addEventListener('submit', (event) => {
  event.preventDefault();
  if (event.target instanceof HTMLFormElement) applyPreviewForm(event.target);
});

root.addEventListener('keydown', (event) => {
  const field = event.target;
  if (field instanceof HTMLButtonElement && field.getAttribute('role') === 'tab') {
    navigateDiffTabs(event, field);
    return;
  }
  if (
    event.key !== 'Enter' ||
    !(field instanceof HTMLInputElement) ||
    field.id !== 'arc-topic-entry'
  )
    return;
  event.preventDefault();
  if (field.form) applyPreviewForm(field.form);
});

dom('.arc-footer-state').innerHTML = roundFooter();
render();
