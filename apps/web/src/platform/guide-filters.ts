import { Fragment, createElement as h } from 'react';
import { SelectField, TopicPicker } from '../../../../packages/ui/src/index.js';
import type { GuideKind } from './guide.js';

export interface GuideFilter {
  kind: GuideKind;
  order: 'priority' | 'updated' | 'name';
  search: string;
  topics: string[];
  changed: boolean;
}

interface FilterProps {
  filter: GuideFilter;
  topics: string[];
  update: (filter: GuideFilter) => void;
}

/** Apply additional filters without coupling the explorer to its data source. */
export function GuideFilters({ filter, topics, update }: FilterProps) {
  return h(
    'div',
    { className: 'arc-guide-filters' },
    h(GuideSelects, { filter, update }),
    h(
      'label',
      { className: 'arc-guide-search' },
      'Search',
      h('input', {
        type: 'search',
        value: filter.search,
        placeholder: 'Search file name and content',
        onChange: (event) => update({ ...filter, search: event.currentTarget.value }),
      }),
    ),
    h(TopicPicker, {
      options: topics,
      selected: filter.topics,
      change: (topics) => update({ ...filter, topics }),
    }),
    h(ChangedOnly, { filter, update }),
  );
}

function GuideSelects({ filter, update }: Omit<FilterProps, 'topics'>) {
  return h(
    Fragment,
    null,
    h(SelectField<GuideKind>, {
      label: 'File type',
      value: filter.kind,
      options: [
        { value: 'goals', label: 'Goals' },
        { value: 'objectives', label: 'Objectives' },
      ],
      onChange: (kind) => update({ ...filter, kind, topics: [] }),
    }),
    h(SelectField<GuideFilter['order']>, {
      label: 'Sort by',
      value: filter.order,
      options: [
        { value: 'priority', label: 'Priority' },
        { value: 'updated', label: 'Last updated' },
        { value: 'name', label: 'Name' },
      ],
      onChange: (order) => update({ ...filter, order }),
    }),
  );
}

function ChangedOnly({ filter, update }: Omit<FilterProps, 'topics'>) {
  return h(
    'label',
    { className: 'arc-guide-checkbox' },
    h('input', {
      type: 'checkbox',
      checked: filter.changed,
      onChange: (event) => update({ ...filter, changed: event.currentTarget.checked }),
    }),
    'Changed only',
  );
}
