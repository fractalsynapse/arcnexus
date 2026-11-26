import { createElement as h, useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from './button.js';
import { tabDestination } from './tab-navigation.js';

export interface TabSection {
  title: string;
  content: ReactNode;
  count?: number;
}

/** Render one section at a time while exposing standard accessible tab navigation. */
export function Tabs({ label, sections }: { label: string; sections: readonly TabSection[] }) {
  const id = useId();
  const [selected, select] = useState(sections[0]?.title);
  const current = Math.max(
    0,
    sections.findIndex(({ title }) => title === selected),
  );
  return h(
    'div',
    { className: 'arc-tabs' },
    h(
      'div',
      { role: 'tablist', 'aria-label': label, className: 'arc-tab-list', onKeyDown: moveTab },
      sections.map((section, index) => tab(section, id + index, index === current, select)),
    ),
    sections.map((section, index) => tabPanel(section, id + index, index === current)),
  );
}

function tabPanel({ title, content }: TabSection, id: string, active: boolean) {
  return h(
    'div',
    {
      key: title,
      id: id + '-panel',
      role: 'tabpanel',
      'aria-labelledby': id + '-tab',
      tabIndex: 0,
      hidden: !active,
    },
    active ? content : null,
  );
}

function tab(
  { title, count }: TabSection,
  id: string,
  active: boolean,
  select: (title: string) => void,
) {
  return h(
    Button,
    {
      key: title,
      id: id + '-tab',
      role: 'tab',
      className: 'arc-tab',
      'aria-controls': id + '-panel',
      'aria-selected': active,
      tabIndex: active ? 0 : -1,
      onClick: () => select(title),
    },
    title,
    count !== undefined && h('span', { className: 'arc-tab-count', 'aria-hidden': true }, count),
  );
}

function moveTab(event: KeyboardEvent<HTMLDivElement>) {
  const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(':scope > [role=tab]')];
  const target = tabDestination(
    event.key,
    tabs.indexOf(event.target as HTMLButtonElement),
    tabs.length,
  );
  const next = target === undefined ? undefined : tabs[target];
  if (!next) return;
  event.preventDefault();
  next.click();
  next.focus();
}
