import { createElement as h, type ReactNode } from 'react';
import { Disclosure } from '../controls/disclosure.js';

/** Mount a structured value's children only while its disclosure is open. */
export function StructuredBranch({
  label,
  expanded = false,
  render,
}: {
  label: ReactNode;
  expanded?: boolean;
  render: () => ReactNode;
}) {
  return h(Disclosure, {
    label,
    defaultOpen: expanded,
    className: 'arc-structured-branch',
    children: () => h('div', null, render()),
  });
}
