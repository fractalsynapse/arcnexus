import type { Project } from '../../src/platform/session.js';

export const project: Project = {
  id: 'arcnexus',
  remote: 'https://github.com/fractalsynapse/arcnexus',
  name: 'ArcNexus',
  revision: 'fixture',
};

const fixtureProviders = [
  { id: 'desktop', name: 'Workstation', platform: 'Linux · x64', state: 'admitted', online: true },
  { id: 'server', name: 'Build host', platform: 'Linux · ARM64', state: 'admitted', online: false },
  { id: 'laptop', name: 'Laptop', platform: 'macOS · ARM64', state: 'pending', online: false },
];

/** Drive the same browser components with local-only fixture transport. */
export function fixtureTransport(showProviders: boolean) {
  const projects = new Map([[project.id, project]]);
  const providers = showProviders ? fixtureProviders.map((provider) => ({ ...provider })) : [];
  return async (path: string, request: RequestInit) => {
    if (path === '/capacity-providers/codes') return Response.json({ code: 'PREVIEW-SETUP' });
    if (path === '/capacity-providers') return Response.json(providers);
    if (path.startsWith('/capacity-providers/')) {
      const provider = providers.find(({ id }) => path.endsWith('/' + id));
      if (provider) provider.state = provider.state === 'pending' ? 'admitted' : 'revoked';
      return Response.json(provider ?? {});
    }
    if (path === '/projects') return fixtureProjects(projects, request);
    if (request.method === 'DELETE') projects.delete(path.split('/').at(-1)!);
    return Response.json({ entries: [] });
  };
}

function fixtureProjects(projects: Map<string, Project>, request: RequestInit) {
  if (request.method !== 'POST') return Response.json({ entries: [...projects.values()] });
  const { remote } = JSON.parse(String(request.body)) as { remote: string };
  const url = URL.parse(remote);
  if (url?.origin !== 'https://github.com') return Response.json({}, { status: 400 });
  const project = { id: crypto.randomUUID(), remote, revision: 'fixture' };
  projects.set(project.id, project);
  return Response.json(project, { status: 201 });
}
