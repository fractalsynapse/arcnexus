import { createElement as h, useState } from 'react';
import {
  Button,
  DialogButton,
  ManagementRow,
  SelectField,
} from '../../../../packages/ui/src/index.js';
import { AddProject } from './add-project.js';
import { initialProject, selectProject, useActiveProject } from './active-project.js';
import type { Project } from './active-project.js';

/** Keep one active project selection across all workspaces in the preview frame. */
export function ProjectManager() {
  const [projects, setProjects] = useState<Project[]>([initialProject]);
  const active = useActiveProject()?.url ?? '';
  const remove = (url: string) => {
    const remaining = projects.filter((project) => project.url !== url);
    setProjects(remaining);
    if (url === active) selectProject(remaining.find((project) => project.reachable));
  };
  return h(DialogButton, {
    icon: 'folder',
    title: 'Project manager',
    children: h(ProjectList, {
      projects,
      active,
      select: (url) => selectProject(projects.find((project) => project.url === url)),
      remove,
      add: (project) => setProjects((list) => [...list, project]),
    }),
  });
}

interface ProjectListProps {
  projects: Project[];
  active: string;
  select: (url: string) => void;
  add: (project: Project) => void;
  remove: (url: string) => void;
}

function ProjectList({ projects, active, select, add, remove }: ProjectListProps) {
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h(SelectField<string>, {
      label: 'Active project',
      value: active,
      options: [
        { value: '', label: 'No active project' },
        ...projects.map(({ url, name }) => ({ value: url, label: name })),
      ],
      onChange: select,
    }),
    projects.length
      ? h(
          'ul',
          { className: 'arc-management-list', 'aria-label': 'Projects' },
          projects.map((project) => projectRow(project, () => remove(project.url))),
        )
      : h('p', null, 'No projects registered.'),
    h(AddProject, { projects, onAdd: add }),
  );
}

function projectRow(project: Project, remove: () => void) {
  return h(ManagementRow, {
    key: project.url,
    title: h('a', { href: project.url, target: '_blank', rel: 'noreferrer' }, project.name),
    detail: project.url,
    status: project.reachable
      ? { label: 'Reachable', tone: 'positive' }
      : { label: 'Reachability unchecked', tone: 'neutral' },
    action: h(Button, { 'aria-label': 'Remove ' + project.name, onClick: remove }, 'Remove'),
  });
}
