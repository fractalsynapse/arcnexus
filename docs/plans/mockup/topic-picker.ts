import { fileArea, files, root, state } from './model.ts';
import type { Revision } from './model.ts';
import { escape, pill } from './view.ts';

type TopicDraft = { revision: Revision; selected: string[]; input: string };
let draft: TopicDraft | undefined;

export function topicKey(topic: string) {
  return topic.trim().toLowerCase();
}

export function filterTopics() {
  return picker('filter', state.filters[fileArea()].topics, '');
}

export function fileTopics(revision: Revision, editing: boolean) {
  if (!editing) {
    clearTopicDraft();
    return `<div class="arc-topic-picker"><span class="arc-field-label">Topics</span>
      <div class="arc-chips">${revision.topics.map((name) => pill(name, 'quiet')).join('') || '<small>No topics</small>'}</div></div>`;
  }
  if (draft?.revision !== revision) {
    draft = { revision, selected: mergeTopics([], revision.topics), input: '' };
  }
  return picker('file', draft.selected, draft.input);
}

export function clearTopicDraft() {
  draft = undefined;
}

export function savedTopics(revision: Revision) {
  return draft?.revision === revision
    ? mergeTopics(draft.selected, parseTopics(draft.input))
    : revision.topics;
}

function picker(kind: 'file' | 'filter', selected: string[], input: string) {
  const id = `arc-${kind}-topic`;
  return `<div class="arc-topic-picker" data-topic-picker="${kind}">
    <label for="${id}">Topics</label>
    <div class="arc-filter-pair">
      <input id="${id}" data-topic-entry list="${id}-choices" autocomplete="off"
        placeholder="${kind === 'file' ? 'Find or create topics' : 'Find topics'}" value="${escape(input)}">
      <button class="arc-button" type="button" data-topic-add aria-label="Add topics">+</button>
    </div>
    <small class="arc-topic-feedback" data-topic-feedback role="status"></small>
    <datalist id="${id}-choices">${topicOptions(selected)}</datalist>
    <div class="arc-chips" data-topic-chips>${chips(selected)}</div>
  </div>`;
}

function catalogTopics() {
  const choices = new Map<string, string>();
  for (const file of files) {
    for (const topic of file.revisions[0]?.topics ?? []) {
      const key = topicKey(topic);
      if (key && !choices.has(key)) choices.set(key, topic.trim());
    }
  }
  return choices;
}

function mergeTopics(selected: string[], entered: string[]) {
  const catalog = catalogTopics();
  const unique = new Map<string, string>();
  for (const topic of [...selected, ...entered]) {
    const key = topicKey(topic);
    if (key && !unique.has(key)) unique.set(key, catalog.get(key) ?? topic.trim());
  }
  return [...unique.values()];
}

function parseTopics(text: string) {
  return text
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function topicOptions(selected: string[]) {
  const selectedKeys = new Set(selected.map(topicKey));
  return [...catalogTopics()]
    .filter(([key]) => !selectedKeys.has(key))
    .map(([, topic]) => topic)
    .sort((a, b) => a.localeCompare(b))
    .map((topic) => `<option value="${escape(topic)}"></option>`)
    .join('');
}

function chips(selected: string[]) {
  return selected
    .map(
      (topic) => `<button type="button" class="arc-pill" data-topic-remove="${escape(topic)}"
    aria-label="Remove topic ${escape(topic)}">${escape(topic)} ×</button>`,
    )
    .join('');
}

function changeTopics(picker: HTMLElement, removed: string | undefined, updateFiles: () => void) {
  const input = picker.querySelector<HTMLInputElement>('[data-topic-entry]');
  if (!input) return;
  const filter = picker.dataset.topicPicker === 'filter' ? state.filters[fileArea()] : undefined;
  const selected = filter?.topics ?? draft?.selected ?? [];
  const entered = removed ? [] : parseTopics(input.value);
  const feedback = picker.querySelector('[data-topic-feedback]');
  if (filter && entered.some((topic) => !catalogTopics().has(topicKey(topic)))) {
    if (feedback) feedback.textContent = 'Choose a topic used by an existing file.';
    input.focus();
    return;
  }
  const next = mergeTopics(
    selected.filter((topic) => topic !== removed),
    entered,
  );
  if (filter) filter.topics = next;
  else if (draft) {
    draft.selected = next;
    if (!removed) draft.input = '';
  }
  if (!removed) input.value = '';
  if (feedback) feedback.textContent = '';
  const list = picker.querySelector('[data-topic-chips]');
  if (list) list.innerHTML = chips(next);
  const choices = picker.querySelector('datalist');
  if (choices) choices.innerHTML = topicOptions(next);
  if (filter) updateFiles();
  input.focus({ preventScroll: true });
}

export function bindTopicPickers(updateFiles: () => void) {
  root.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.hasAttribute('data-topic-entry')) return;
    const picker = input.closest<HTMLElement>('[data-topic-picker]');
    const feedback = picker?.querySelector('[data-topic-feedback]');
    if (feedback) feedback.textContent = '';
    if (draft && picker?.dataset.topicPicker === 'file') draft.input = input.value;
  });
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || !(event.target instanceof HTMLInputElement))
      return;
    if (!event.target.hasAttribute('data-topic-entry')) return;
    const picker = event.target.closest<HTMLElement>('[data-topic-picker]');
    if (!picker) return;
    event.preventDefault();
    changeTopics(picker, undefined, updateFiles);
  });
  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-topic-add],[data-topic-remove]');
    const picker = button?.closest<HTMLElement>('[data-topic-picker]');
    if (button && picker) changeTopics(picker, button.dataset.topicRemove, updateFiles);
  });
}
