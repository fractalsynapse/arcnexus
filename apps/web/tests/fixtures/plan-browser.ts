import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { chromium, type BrowserContextOptions, type Page } from 'playwright';
import { serveWeb } from '../../src/serve.js';
import { chooseOption } from './browser-select.js';
import { preferenceRoutes } from './preferences.js';

export const project = {
  id: 'bound-project',
  name: 'plan',
  remote: 'https://github.com/example/plan.git',
  revision: 'a'.repeat(40),
};
export const otherProject = {
  id: 'other-project',
  name: 'Other project',
  remote: 'https://github.com/example/other.git',
  revision: project.revision,
};

export async function browserPage(t: TestContext, api?: URL, options?: BrowserContextOptions) {
  const application = await serveWeb('dist/apps/web/site', 0, '127.0.0.1', api);
  t.after(() => application.server.close());
  const browser = await chromium.launch({ executablePath: process.env.ARC_CHROMIUM_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage(options);
  return { application, page };
}

export async function responses(page: Page, projects = [project]) {
  const requests: string[] = [];
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    if (url.pathname === '/api/capacity-providers') return route.fulfill({ json: [] });
    return route.fulfill({ json: planData(url.pathname, projects) });
  });
  await preferenceRoutes(page);
  return requests;
}

export const fixtureGoal = { id: 'fixture-goal', path: '.arc/goals/fixture-goal.md', priority: 1 };
export const fixtureContent = '---\npriority: 1\n---\n\n# Verified goal';

export function planData(path: string, projects = [project]) {
  if (path === '/api/projects') return { entries: projects };
  if (path === '/api/projects/' + project.id) return project;
  if (path === '/api/projects/' + otherProject.id) return otherProject;
  if (path.endsWith('/plan-executions')) return { entries: [] };
  if (path.endsWith('/current'))
    return { revision: project.revision, execution: null, active: false };
  if (path.endsWith('/goals')) return { revision: project.revision, entries: [fixtureGoal] };
  if (path.endsWith('/objectives')) return { entries: [] };
  if (path.endsWith('/revisions')) return { revisions: [] };
  if (path.endsWith('/changes'))
    return { path: fixtureGoal.path, before: '# Previous', after: '# Verified goal' };
  return { revision: project.revision, entry: fixtureGoal, content: fixtureContent };
}

export async function selectProject(page: Page, id = project.id) {
  await page.getByRole('button', { name: 'Project manager' }).click();
  assert.equal(await page.getByLabel('Operator credential', { exact: true }).count(), 0);
  const target = id === otherProject.id ? otherProject : project;
  await chooseOption(page, 'Active project', target.name);
  await page.getByRole('button', { name: 'Close' }).click();
}
