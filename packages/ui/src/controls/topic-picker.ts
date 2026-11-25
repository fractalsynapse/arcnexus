import { createElement as h, useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { IconButton } from './icon-button.js';

interface TopicProps {
  label?: string;
  options: readonly string[];
  selected: readonly string[];
  change: (selected: string[]) => void;
  creatable?: boolean;
}

/** Filter a shared topic vocabulary and optionally accept a new typed topic. */
export function TopicPicker(props: TopicProps) {
  const id = useId();
  const state = useTopicPicker(props);
  return h(
    'div',
    { className: 'arc-field arc-topic-picker' },
    h('label', { htmlFor: id }, props.label ?? 'Topics'),
    h(TopicTags, {
      selected: props.selected,
      remove: (topic) => props.change(props.selected.filter((item) => item !== topic)),
    }),
    h(TopicInput, { id, state }),
    state.open && h(TopicOptions, { id: id + '-options', ...state }),
  );
}

function useTopicPicker({ options, selected, change, creatable }: TopicProps) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = input.trim();
  const candidates = topicMatches(options, selected, query, creatable);
  const pick = (topic: string) => {
    change([...selected, topic]);
    setInput('');
    setActive(0);
    setOpen(false);
  };
  const onKey = (event: KeyboardEvent<HTMLInputElement>) =>
    topicKey(event, { open, active, candidates, pick, setOpen, setActive });
  const search = (value: string) => {
    setInput(value);
    setActive(0);
    setOpen(true);
  };
  return { input, open, active, candidates, pick, onKey, search, setOpen };
}

function topicMatches(
  options: readonly string[],
  selected: readonly string[],
  query: string,
  creatable?: boolean,
) {
  const included = new Set(selected.map((item) => item.toLocaleLowerCase()));
  const needle = query.toLocaleLowerCase();
  const matches = options.filter((item) => {
    const value = item.toLocaleLowerCase();
    return !included.has(value) && value.includes(needle);
  });
  return matches.length || !query || !creatable || included.has(needle) ? matches : [query];
}

interface TopicKeys {
  open: boolean;
  active: number;
  candidates: string[];
  pick: (topic: string) => void;
  setOpen: (open: boolean) => void;
  setActive: (active: number) => void;
}

function topicKey(event: KeyboardEvent<HTMLInputElement>, state: TopicKeys) {
  if (event.key === 'Escape') state.setOpen(false);
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const step = event.key === 'ArrowDown' ? 1 : -1;
    state.setOpen(true);
    state.setActive(Math.max(0, Math.min(state.candidates.length - 1, state.active + step)));
  }
  const topic = state.candidates[state.active];
  if (event.key !== 'Enter' || !state.open || !topic) return;
  event.preventDefault();
  state.pick(topic);
}

function TopicInput({ id, state }: { id: string; state: ReturnType<typeof useTopicPicker> }) {
  const { input, open, active, candidates, setOpen, search, onKey } = state;
  return h('input', {
    id,
    value: input,
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': open,
    'aria-controls': open ? id + '-options' : undefined,
    'aria-activedescendant': open && candidates[active] ? id + '-options-' + active : undefined,
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onKeyDown: onKey,
    onChange: (event) => search(event.currentTarget.value),
  });
}

function TopicTags({
  selected,
  remove,
}: {
  selected: readonly string[];
  remove: (topic: string) => void;
}) {
  return h(
    'div',
    { className: 'arc-topic-tags' },
    selected.map((topic) =>
      h(
        'span',
        { key: topic },
        topic,
        h(IconButton, { icon: 'close', label: 'Remove ' + topic, onClick: () => remove(topic) }),
      ),
    ),
  );
}

function TopicOptions({
  id,
  candidates,
  active,
  pick,
}: Pick<TopicKeys, 'candidates' | 'active' | 'pick'> & { id: string }) {
  return h(
    'div',
    { id, className: 'arc-topic-options', role: 'listbox', 'aria-label': 'Matching topics' },
    candidates.length === 0 && h('small', null, 'No matching topics'),
    candidates.map((topic, index) =>
      h(
        'button',
        {
          key: topic,
          id: id + '-' + index,
          tabIndex: -1,
          type: 'button',
          role: 'option',
          'aria-selected': active === index,
          onPointerDown: (event) => event.preventDefault(),
          onClick: () => pick(topic),
        },
        topic,
      ),
    ),
  );
}
