import { currentGoal } from './run-context.ts';
import {
  target,
  previewRows,
  composerUI,
  enqueue,
  advanceQueue,
  submitComposer,
} from './composer.ts';
import { loadDiffPatch } from './diff.ts';
import { navigateTabs, selectTab } from './tab-controls.ts';
import { workspaceIndex, updateFileList, fileView } from './files.ts';
import { highlightFileCode } from './markdown.ts';
import { detachMarkdownEditor, editedMarkdown, mountMarkdownEditor } from './mdx-editor.ts';
import { detachYamlEditor, mountYamlEditor, mountYamlMarkdownField, saveYamlDraft } from './yaml-editor.ts';
import { closeProse, collapseProse, showProse } from './prose-dialog.ts';
import { hasYamlForm } from './yaml-schema.ts';
import { standalonePane, togglePane } from './panels.ts';
import { openQuestion, questionView, rememberAnswer, submitAnswer } from './questions.ts';
import { openRoundMetrics, roundFooter } from './round.ts';
import { openGoalProgress } from './ogsm.ts';
import {
  data,
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
import { runIndex, sectionDetail, actorLog, compPage, activityPage } from './run.ts';
import { releasePage } from './run-release.ts';
import { changeSnapshotPreview, selectStagingRevision, snapshotReleasePage } from './snapshot-release.ts';
import { advanceProductionPreview, recordProductionDecision, selectProductionScenario } from './production-preview.ts';
import { productionApprovalPage, productionIncidentPage } from './production-release.ts';
import { inspect, openArtifact, renderCalls, eventLogPane } from './timeline.ts';
import { dismissTooltip } from './tooltip.ts';
import { bindTopicPickers, clearTopicDraft, closeTopicPopup, savedTopics } from './topic-picker.ts';
import { icon, button, icons } from './view.ts';

export function workspace(): Workspace {
  if (state.route.startsWith('/release/')) return 'release';
  if (state.route.startsWith('/run/')) return 'run';
  return state.route.startsWith('/architect/') ? 'architect' : 'plan';
}

export function renderCommand(reset = false) {
  const detailPage = state.route.endsWith('/file/') || state.route.endsWith('/question/') || state.route === '/release/approval/';
  const headerAction = dom('.arc-header-action');
  headerAction.innerHTML = detailPage
    ? button('Back', '/' + workspace() + '/', 'arrow-left')
    : state.route === '/run/direction/log/'
      ? button('Director', '/run/direction/', 'arrow-left')
      : state.route === '/run/review/log/'
        ? button('Reviewer', '/run/review/', 'arrow-left')
        : workspace() === 'release'
          ? ''
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
  '/architect/question/': questionView,
  '/run/': runIndex,
  '/run/direction/': () => sectionDetail('Direction'),
  '/run/direction/log/': () => actorLog('Direction'),
  '/run/component/focus/': () => compPage(true),
  '/run/component/activities/': () => compPage(false),
  '/run/activity/focus/': () => activityPage(true),
  '/run/activity/activities/': () => activityPage(false),
  '/run/review/': () => sectionDetail('Review'),
  '/run/review/log/': () => actorLog('Review'),
  '/run/delivery/': releasePage,
  '/run/incident/': productionIncidentPage,
  '/release/': snapshotReleasePage,
  '/release/approval/': productionApprovalPage,
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
  dismissTooltip();
  closeTopicPopup();
  closeProse();
  detachMarkdownEditor();
  detachYamlEditor();
  main.innerHTML = requireValue(routes[r])();
  highlightFileCode(main);
  const file = files[state.fileId];
  const revision = file?.revisions[state.revision];
  mountMarkdownEditor(main.querySelector('[data-md-editor]'), revision);
  mountYamlEditor(main, file, revision);
  const added = previewRows();
  if (added.length && !r.endsWith('/question/') && !main.querySelector('.arc-grouped-log')) {
    const logPane = eventLogPane(requireValue(target()).role, added, false);
    main.insertAdjacentHTML('beforeend', `<div class="arc-live-log">${standalonePane(logPane)}</div>`);
  }
  updateFileList();
  renderCommand(resetComposer);
  icons();
}

export function go(route: string) {
  dom<HTMLDialogElement>('.arc-inspector').close();
  clearTopicDraft();
  state.route = route;
  state.expandedPane = null;
  state.editing = false;
  state.saved = false;
  render(true);
  main.querySelector('h1')?.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function openFile(id: string) {
  state.fileId = Number(id);
  state.revision = 0;
  go('/' + requireValue(files[state.fileId]).area + '/file/');
}

export function handleClick(control: HTMLButtonElement) {
  const { go: route, file: id, goal, component, activity, action, question, inspect: record } =
    control.dataset;
  if (question) openQuestion(question);
  else if (record) {
    const row = displayedRows.get(record);
    if (row) inspect(row, control);
  } else if (route) {
    if (goal) changeRun(goal);
    go(route);
  } else if (id !== undefined) openFile(id);
  else if (component) {
    state.component = component;
    state.milestone = '';
    state.activity = 'implementation';
    go('/run/component/focus/');
  } else if (activity) {
    state.activity = activity;
    go('/run/activity/focus/');
  } else if (action) handleAction(control, action);
}

export function handleAction(control: HTMLButtonElement, action: string) {
  if (action === 'close-inspector') dom<HTMLDialogElement>('.arc-inspector').close();
  else if (action === 'open-prose') showProse(control, mountYamlMarkdownField);
  else if (action === 'collapse-prose') collapseProse(control);
  else if (action === 'close-prose') closeProse();
  else if (action === 'round-metrics') openRoundMetrics(control);
  else if (action === 'goal-progress') openGoalProgress(control);
  else if (action === 'apply-form') applyPreviewForm(requireValue(control.closest('form')));
  else if (action === 'refine') enqueue('refine', '');
  else if (action === 'advance-queue') advanceQueue();
  else if (state.route === '/release/approval/' && recordProductionDecision(action)) {
    go('/release/');
    dom<HTMLElement>('#arc-production-release').focus();
  } else if (state.route === '/release/' && advanceProductionPreview(action)) {
    render();
    dom<HTMLElement>('#arc-production-release').focus({ preventScroll: true });
  } else if (state.route === '/release/' && changeSnapshotPreview(action)) {
    render();
    dom<HTMLElement>('[data-change="staging-revision"]').focus({ preventScroll: true });
  }
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
  if (form.dataset.form !== 'file' || !state.editing) return;
  saveRevision(data);
}

function saveRevision(data: FormData) {
  const item = requireValue(files[state.fileId]);
  const revision = requireValue(item.revisions[state.revision]);
  let content: string | undefined = String(data.get('content'));
  if (item.path.endsWith('.md')) content = editedMarkdown(revision);
  else if (hasYamlForm(item)) content = saveYamlDraft();
  if (content === undefined) return;
  item.revisions.unshift({
    id: 'Draft ' + (item.revisions.filter((r) => r.id.startsWith('Draft')).length + 1),
    name: String(data.get('name')).trim(),
    priority: data.get('priority') ? Number(data.get('priority')) : null,
    topics: savedTopics(revision),
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
  if (control.getAttribute('role') === 'tab') selectTab(control);
  else if (control.dataset.expandPane) togglePane(control);
  else handleClick(control);
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
  else if (kind === 'staging-revision') return selectStagingRevision(value);
  else if (kind === 'production-scenario') return selectProductionScenario(value);
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
    navigateTabs(event, field);
  }
});

bindTopicPickers(updateFileList);
if (data.fileReview) {
  root.setAttribute('data-file-review', '');
  dom<HTMLButtonElement>('.arc-brand').disabled = true;
}
dom('.arc-footer-state').innerHTML = roundFooter();
render();
