import { fileArea, files, root, state } from './model.ts';
import type { Revision } from './model.ts';
import { escape, pill } from './view.ts';

type TopicDraft = { revision: Revision; selected: string[]; input: string };
let draft: TopicDraft | undefined;
type TopicMenu = {
  input: HTMLInputElement;
  picker: HTMLElement;
  popup: HTMLElement;
  list: HTMLElement;
  status: HTMLElement;
};
let menu: TopicMenu | undefined;

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
    <input id="${id}" data-topic-entry autocomplete="off" role="combobox" aria-autocomplete="list"
      aria-controls="${id}-choices" aria-expanded="false"
      placeholder="${kind === 'file' ? 'Find or create topics' : 'Find topics'}" value="${escape(input)}">
    <div class="arc-topic-popup" popover="manual" data-topic-popup>
      <div class="arc-topic-message" data-topic-message role="status"></div>
      <div id="${id}-choices" role="listbox" aria-label="Suggested topics"></div>
    </div>
    <small class="arc-topic-feedback" data-topic-feedback role="status"></small>
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

function chips(selected: string[]) {
  return selected
    .map(
      (topic) => `<button type="button" class="arc-pill" data-topic-remove="${escape(topic)}"
    aria-label="Remove topic ${escape(topic)}">${escape(topic)} ×</button>`,
    )
    .join('');
}

function changeTopics(
  picker: HTMLElement,
  entered: string[],
  updateFiles: () => void,
  removed?: string,
) {
  const input = picker.querySelector<HTMLInputElement>('[data-topic-entry]');
  if (!input) return;
  const filter = picker.dataset.topicPicker === 'filter' ? state.filters[fileArea()] : undefined;
  const selected = filter?.topics ?? draft?.selected ?? [];
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
  finishTopicChange(picker, input, next);
  if (filter) updateFiles();
}

function finishTopicChange(picker: HTMLElement, input: HTMLInputElement, selected: string[]) {
  const list = picker.querySelector('[data-topic-chips]');
  if (list) list.innerHTML = chips(selected);
  const feedback = picker.querySelector('[data-topic-feedback]');
  if (feedback) feedback.textContent = '';
  input.focus({ preventScroll: true });
  closeTopicPopup();
}

export function closeTopicPopup() {
  if (!menu) return;
  menu.input.setAttribute('aria-expanded', 'false');
  menu.input.removeAttribute('aria-activedescendant');
  menu.popup.hidePopover();
  menu = undefined;
}

function topicMenu(input: HTMLInputElement) {
  const picker = input.closest<HTMLElement>('[data-topic-picker]');
  const popup = picker?.querySelector<HTMLElement>('[data-topic-popup]');
  const list = popup?.querySelector<HTMLElement>('[role=listbox]');
  const status = popup?.querySelector<HTMLElement>('[data-topic-message]');
  if (!picker || !popup || !list || !status) return;
  return { input, picker, popup, list, status };
}

function showTopicPopup(input: HTMLInputElement) {
  if (menu?.input !== input) {
    closeTopicPopup();
    menu = topicMenu(input);
  }
  if (!menu) return;
  renderTopicMatches(menu);
  input.setAttribute('aria-expanded', 'true');
  if (!menu.popup.matches(':popover-open')) menu.popup.showPopover();
  positionTopicPopup();
}

function renderTopicMatches({ input, picker, list, status }: TopicMenu) {
  const creating = picker.dataset.topicPicker === 'file';
  const selected = creating ? (draft?.selected ?? []) : state.filters[fileArea()].topics;
  const selectedKeys = new Set(selected.map(topicKey));
  const query = input.value.split(',').at(-1)?.trim() ?? '';
  const key = topicKey(query);
  const catalog = catalogTopics();
  const matches = [...catalog]
    .filter(([keyOfTopic]) => !selectedKeys.has(keyOfTopic) && keyOfTopic.includes(key))
    .map(([, topic]) => topic)
    .sort((a, b) => a.localeCompare(b));
  const rows = matches.map((name, index) => topicOption(list.id, index, name, name));
  if (creating && key && !catalog.has(key) && !selectedKeys.has(key)) {
    rows.push(topicOption(list.id, rows.length, query, `Create “${query}”`, 'arc-topic-create'));
  }
  list.innerHTML = rows.join('');
  status.textContent = matches.length
    ? ''
    : selectedKeys.has(key)
      ? 'Topic already selected.'
      : 'No matching topics.';
  input.removeAttribute('aria-activedescendant');
}

function topicOption(listId: string, index: number, value: string, name: string, classes = '') {
  return `<div role="option" aria-selected="false" id="${listId}-${index}" class="arc-topic-option ${classes}"
    data-topic-option="${escape(value)}">${escape(name)}</div>`;
}

function positionTopicPopup() {
  if (!menu) return;
  const { input, popup } = menu;
  const anchor = input.getBoundingClientRect();
  const viewport = document.documentElement.clientHeight;
  if (anchor.bottom <= 0 || anchor.top >= viewport || !anchor.width) {
    closeTopicPopup();
    return;
  }
  const gap = 4;
  const below = viewport - anchor.bottom - gap;
  const above = anchor.top - gap;
  popup.style.left = `${anchor.left}px`;
  popup.style.inlineSize = `${anchor.width}px`;
  const opensAbove =
    popup.scrollHeight + popup.offsetHeight - popup.clientHeight > below && above > below;
  popup.style.top = opensAbove ? '' : `${anchor.bottom + gap}px`;
  popup.style.bottom = opensAbove ? `${viewport - anchor.top + gap}px` : '';
  popup.style.maxBlockSize = `${opensAbove ? above : below}px`;
}

function moveTopicFocus(input: HTMLInputElement, direction: number) {
  if (menu?.input !== input) showTopicPopup(input);
  const choices = [...(menu?.list.querySelectorAll<HTMLElement>('[data-topic-option]') ?? [])];
  const current = choices.findIndex(
    (choice) => choice.id === input.getAttribute('aria-activedescendant'),
  );
  const index =
    current < 0 && direction < 0
      ? choices.length - 1
      : Math.max(0, Math.min(choices.length - 1, current + direction));
  const choice = choices[index];
  if (!choice) return;
  choices[current]?.setAttribute('aria-selected', 'false');
  choice.setAttribute('aria-selected', 'true');
  input.setAttribute('aria-activedescendant', choice.id);
  choice.scrollIntoView({ block: 'nearest' });
}

function chooseTopic(input: HTMLInputElement, updateFiles: () => void, choice?: string) {
  const picker = input.closest<HTMLElement>('[data-topic-picker]');
  if (!picker) return;
  const entered =
    choice === undefined
      ? parseTopics(input.value)
      : [...parseTopics(input.value.split(',').slice(0, -1).join(',')), choice];
  changeTopics(picker, entered, updateFiles);
}

function topicInput(target: EventTarget | null): HTMLInputElement | undefined {
  if (target instanceof HTMLInputElement && target.hasAttribute('data-topic-entry')) return target;
}

function topicKeydown(event: KeyboardEvent, updateFiles: () => void) {
  const input = topicInput(event.target);
  if (!input || event.isComposing) return;
  if (event.key === 'Escape' && menu) {
    event.preventDefault();
    closeTopicPopup();
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    moveTopicFocus(input, event.key === 'ArrowDown' ? 1 : -1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const selected = menu?.list.querySelector<HTMLElement>('[aria-selected=true]');
    chooseTopic(input, updateFiles, selected?.dataset.topicOption);
  }
}

function clickTopic(event: MouseEvent, updateFiles: () => void) {
  if (!(event.target instanceof Element)) return;
  const option = event.target.closest<HTMLElement>('[data-topic-option]');
  if (option && menu) {
    chooseTopic(menu.input, updateFiles, option.dataset.topicOption);
    return;
  }
  const button = event.target.closest<HTMLElement>('[data-topic-remove]');
  const picker = button?.closest<HTMLElement>('[data-topic-picker]');
  if (button && picker) changeTopics(picker, [], updateFiles, button.dataset.topicRemove);
}

function editTopicInput(input: HTMLInputElement) {
  const picker = input.closest<HTMLElement>('[data-topic-picker]');
  const feedback = picker?.querySelector('[data-topic-feedback]');
  if (feedback) feedback.textContent = '';
  if (draft && picker?.dataset.topicPicker === 'file') draft.input = input.value;
  showTopicPopup(input);
}

export function bindTopicPickers(updateFiles: () => void) {
  root.addEventListener('input', (event) => {
    const input = topicInput(event.target);
    if (input) editTopicInput(input);
  });
  root.addEventListener('focusin', (event) => {
    const input = topicInput(event.target);
    if (input) showTopicPopup(input);
  });
  root.addEventListener('focusout', (event) => {
    if (menu?.input === event.target) closeTopicPopup();
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !menu?.picker.contains(event.target)) closeTopicPopup();
  });
  root.addEventListener('mousedown', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-topic-option]'))
      event.preventDefault();
  });
  root.addEventListener('keydown', (event) => topicKeydown(event, updateFiles));
  root.addEventListener('click', (event) => {
    const input = topicInput(event.target);
    if (input && menu?.input !== input) showTopicPopup(input);
    else clickTopic(event, updateFiles);
  });
  window.addEventListener('resize', positionTopicPopup);
  window.addEventListener('scroll', positionTopicPopup, true);
}
