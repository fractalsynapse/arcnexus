import { createElement as h, useState } from 'react';
import {
  Button,
  DialogButton,
  ExternalLink,
  ManagementRow,
  SelectField,
} from '../../../../packages/ui/src/index.js';
import type { Project } from './session.js';
import { projectName, setSession, usePlatformSession } from './session.js';
import { api, useResource } from './resource.js';
import { ImportProject } from './project-import.js';

export function ProjectManager() {
  return h(DialogButton, {
    icon: 'folder',
    title: 'Project manager',
    children: h(Projects),
  });
}

function Projects() {
  const { session, projects, change, error, loaded } = useProjects();
  return h(ProjectRows, {
    projects,
    select: (project) => setSession({ ...session, project }),
    selected: session.project?.id,
    error,
    change,
    loaded,
  });
}

function useProjects() {
  const session = usePlatformSession();
  const [refresh, reload] = useState(0);
  const [error, showError] = useState('');
  const result = useResource<{ entries: Project[] }>('/projects', refresh);
  const projects = result.value?.entries ?? [];
  const change = async (project?: Project, remote?: string) => {
    try {
      if (project) {
        await api('/projects/' + project.id, { method: 'DELETE' });
        if (project.id === session.project?.id)
          setSession({ ...session, project: projects.find((item) => item.id !== project.id) });
      } else {
        const added = await api<Project>('/projects', {
          method: 'POST',
          body: JSON.stringify({ remote }),
        });
        setSession({ ...session, project: added });
      }
      showError('');
      reload((index) => index + 1);
      return true;
    } catch (reason) {
      showError((reason as Error).message);
      return false;
    }
  };
  return { session, projects, change, error: error || result.error, loaded: !!result.value };
}

interface ProjectRowsProps {
  projects: Project[];
  selected?: string;
  select(project?: Project): void;
  change(project?: Project, remote?: string): Promise<boolean>;
  error?: string;
  loaded: boolean;
}

function ProjectRows({ projects, selected, select, change, error, loaded }: ProjectRowsProps) {
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
    h(ProjectList, { projects, loaded, remove: (project) => void change(project) }),
    h(ImportProject, { submit: (remote) => change(undefined, remote) }),
    error && h('p', { role: 'alert' }, error),
  );
}

interface ProjectListProps extends Pick<ProjectRowsProps, 'projects' | 'loaded'> {
  remove(project: Project): void;
}

function ProjectList({ projects, loaded, remove }: ProjectListProps) {
  if (!projects.length) return loaded ? h('p', null, 'No projects registered.') : null;
  return h(
    'ul',
    { className: 'arc-management-list', 'aria-label': 'Projects' },
    projects.map((project) =>
      h(ProjectRow, { key: project.id, project, remove: () => remove(project) }),
    ),
  );
}

type Probe = { reachable: true; revision: string } | { reachable: false; diagnostic: string };

interface ProjectRowProps {
  project: Project;
  remove(): void;
}

function ProjectRow({ project, remove }: ProjectRowProps) {
  const { probe, checking, check } = useProjectProbe(project.id);
  const { remote } = project;
  const name = projectName(project);
  return h(ManagementRow, {
    title: h(ExternalLink, { href: remote }, name),
    detail: probe?.reachable === false ? probe.diagnostic : remote,
    status: {
      label: probe ? (probe.reachable ? 'Reachable' : 'Unavailable') : 'Revision verified',
      tone: probe?.reachable === false ? 'neutral' : 'positive',
    },
    statusAction: h(
      Button,
      {
        className: 'arc-management-status-action',
        disabled: checking,
        onClick: () => void check(),
      },
      checking ? 'Checking…' : 'Check reachability',
    ),
    action: h(Button, { 'aria-label': 'Remove ' + name, onClick: remove }, 'Remove'),
  });
}

function useProjectProbe(id: string) {
  const [probe, setProbe] = useState<Probe>();
  const [checking, setChecking] = useState(false);
  async function check() {
    setChecking(true);
    try {
      setProbe(await api<Probe>('/projects/' + id + '/reachability'));
    } catch {
      setProbe({ reachable: false, diagnostic: 'The gateway could not check this project.' });
    } finally {
      setChecking(false);
    }
  }
  return { probe, checking, check };
}
