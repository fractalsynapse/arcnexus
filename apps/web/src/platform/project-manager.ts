import { createElement as h, useState } from 'react';
import {
  Button,
  DialogButton,
  ManagementRow,
  SelectField,
} from '../../../../packages/ui/src/index.js';
import type { Project } from './session.js';
import { projectName, setSession, usePlatformSession } from './session.js';
import { api, useResource } from './resource.js';
import { OperatorGate } from './operator-gate.js';
import { ImportProject } from './project-import.js';

export function ProjectManager() {
  return h(DialogButton, {
    icon: 'folder',
    title: 'Project manager',
    children: h(OperatorGate, { children: h(Projects) }),
  });
}

function Projects() {
  const { session, projects, change, error } = useProjects();
  return h(ProjectRows, {
    projects,
    select: (project) => setSession({ ...session, project }),
    selected: session.project?.id,
    error,
    change,
  });
}

function useProjects() {
  const session = usePlatformSession();
  const [refresh, reload] = useState(0);
  const [error, showError] = useState('');
  const result = useResource<{ entries: Project[] }>('/projects', session.token, refresh);
  const projects = result.value?.entries ?? [];
  const change = async (project?: Project, remote?: string) => {
    try {
      if (project) {
        await api('/projects/' + project.id, session.token!, { method: 'DELETE' });
        if (project.id === session.project?.id)
          setSession({ ...session, project: projects.find((item) => item.id !== project.id) });
      } else {
        const added = await api<Project>('/projects', session.token!, {
          method: 'POST',
          body: JSON.stringify({ remote }),
        });
        setSession({ ...session, project: added });
      }
      showError('');
      reload((index) => index + 1);
    } catch (reason) {
      showError((reason as Error).message);
    }
  };
  return { session, projects, change, error: error || result.error };
}

interface ProjectRowsProps {
  projects: Project[];
  selected?: string;
  select(project?: Project): void;
  change(project?: Project, remote?: string): Promise<void>;
  error?: string;
}

function ProjectRows({ projects, selected, select, change, error }: ProjectRowsProps) {
  return h(
    'div',
    { className: 'arc-platform-stack' },
    h(SelectField<string>, {
      label: 'Active project',
      value: selected ?? '',
      options: [
        { value: '', label: 'No active project' },
        ...projects.map((project) => ({ value: project.id, label: projectName(project) })),
      ],
      onChange: (id) => select(projects.find((project) => project.id === id)),
    }),
    h(
      'ul',
      { className: 'arc-management-list', 'aria-label': 'Projects' },
      projects.map((project) => projectRow(project, () => void change(project))),
    ),
    h(ImportProject, { submit: (remote) => change(undefined, remote) }),
    error && h('p', { role: 'alert' }, error),
  );
}

function projectRow(project: Project, remove: () => void) {
  return h(ManagementRow, {
    key: project.id,
    title: h(
      'a',
      { href: project.remote, target: '_blank', rel: 'noreferrer' },
      projectName(project),
    ),
    detail: project.remote,
    status: { label: 'Revision verified', tone: 'positive' },
    action: h(
      Button,
      { 'aria-label': 'Remove ' + projectName(project), onClick: remove },
      'Remove',
    ),
  });
}
