import { createElement as h, useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from './button.js';
import { tabDestination } from './tab-navigation.js';

export interface TabSection {
  id?: string;
  title: string;
  content: ReactNode;
  count?: number;
}

/** Render one section at a time while exposing standard accessible tab navigation. */
export function Tabs({
  label,
  sections,
  className,
}: {
  label: string;
  sections: readonly TabSection[];
  className?: string;
}) {
  const id = useId();
  const [selected, select] = useState(sections[0] && sectionID(sections[0]));
  const current = Math.max(
    0,
    sections.findIndex((section) => sectionID(section) === selected),
  );
  return h(
    'div',
    { className: className ? 'arc-tabs ' + className : 'arc-tabs' },
    h(
      'div',
      { role: 'tablist', 'aria-label': label, className: 'arc-tab-list', onKeyDown: moveTab },
      sections.map((section, index) => tab(section, id + index, index === current, select)),
    ),
    sections.map((section, index) => tabPanel(section, id + index, index === current)),
  );
}

function tabPanel(section: TabSection, id: string, active: boolean) {
  return h(
    'div',
    {
      key: sectionID(section),
      id: id + '-panel',
      role: 'tabpanel',
      'aria-labelledby': id + '-tab',
      tabIndex: 0,
      hidden: !active,
    },
    active ? section.content : null,
  );
}

function tab(section: TabSection, id: string, active: boolean, select: (title: string) => void) {
  const { title, count } = section;
  return h(
    Button,
    {
      key: sectionID(section),
      id: id + '-tab',
      role: 'tab',
      className: 'arc-tab',
      'aria-controls': id + '-panel',
      'aria-selected': active,
      tabIndex: active ? 0 : -1,
      onClick: () => select(sectionID(section)),
    },
    title,
    count !== undefined && h('span', { className: 'arc-tab-count', 'aria-hidden': true }, count),
  );
}

function sectionID({ id, title }: TabSection) {
  return id ?? title;
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
