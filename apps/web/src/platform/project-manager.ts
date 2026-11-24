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
    token: session.token,
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
  token?: string;
  select(project?: Project): void;
  change(project?: Project, remote?: string): Promise<void>;
  error?: string;
}

function ProjectRows({ projects, selected, token, select, change, error }: ProjectRowsProps) {
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
      projects.map((project) =>
        h(ProjectRow, { key: project.id, project, token, remove: () => void change(project) }),
      ),
    ),
    h(ImportProject, { submit: (remote) => change(undefined, remote) }),
    error && h('p', { role: 'alert' }, error),
  );
}

type Probe = { reachable: true; revision: string } | { reachable: false; diagnostic: string };

interface ProjectRowProps {
  project: Project;
  token?: string;
  remove(): void;
}

function ProjectRow({ project, token, remove }: ProjectRowProps) {
  const { probe, checking, check } = useProjectProbe(project.id, token);
  const { remote } = project;
  const name = projectName(project);
  return h(ManagementRow, {
    title: h('a', { href: remote, target: '_blank', rel: 'noreferrer' }, name),
    detail: probe?.reachable === false ? probe.diagnostic : remote,
    status: {
      label: probe ? (probe.reachable ? 'Reachable' : 'Unavailable') : 'Revision verified',
      tone: probe?.reachable === false ? 'neutral' : 'positive',
    },
    action: h(
      'div',
      { className: 'arc-platform-stack' },
      h(
        Button,
        { disabled: checking || !token, onClick: () => void check() },
        checking ? 'Checking…' : 'Check reachability',
      ),
      h(Button, { 'aria-label': 'Remove ' + name, onClick: remove }, 'Remove'),
    ),
  });
}

function useProjectProbe(id: string, token?: string) {
  const [probe, setProbe] = useState<Probe>();
  const [checking, setChecking] = useState(false);
  async function check() {
    if (!token) return;
    setChecking(true);
    try {
      setProbe(await api<Probe>('/projects/' + id + '/reachability', token));
    } catch {
      setProbe({ reachable: false, diagnostic: 'The gateway could not check this project.' });
    } finally {
      setChecking(false);
    }
  }
  return { probe, checking, check };
}
