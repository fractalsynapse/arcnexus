import { createElement as h } from 'react';
import { projectName, usePlatformSession } from './session.js';

/** Identify the active project using the site's accent color. */
export function ActiveProject() {
  const { project } = usePlatformSession();
  return project
    ? h('strong', { className: 'arc-active-project' }, projectName(project))
    : 'No active project';
}
