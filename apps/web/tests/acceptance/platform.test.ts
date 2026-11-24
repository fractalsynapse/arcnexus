import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { chromium, type Page } from 'playwright';
import { serveWeb } from '../../src/serve.js';

export const suite = { owner: 'web-app', level: 'acceptance', tags: ['browser'] } as const;

const project = {
  id: 'bound-project',
  remote: 'https://github.com/example/plan.git',
  revision: 'verified-revision',
};

test('the built Plan requests only visible project guides and loads detail on demand', async (t) => {
  const { application, page } = await browserPage(t);
  const requests = await responses(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      'arcnexus.web.layout:/plan/',
      JSON.stringify({
        columns: 2,
        order: [],
        hidden: ['objectives'],
        regions: {},
        widths: [],
      }),
    ),
  );
  await page.goto(application.url);
  await selectProject(page);
  const goal = page.getByRole('button', { name: 'fixture-goal' });
  await goal.waitFor();
  assert.ok(
    !requests.some((path) => path.includes('/objectives') || path.includes('/fixture-goal')),
  );
  await goal.click();
  await page.getByText('# Verified goal', { exact: true }).waitFor();
  assert.ok(
    requests.includes(
      '/api/projects/' + project.id + '/goals/fixture-goal?revision=' + project.revision,
    ),
  );
});

async function browserPage(t: TestContext) {
  const application = await serveWeb('dist/apps/web/site');
  t.after(() => application.server.close());
  const browser = await chromium.launch({ executablePath: process.env.ARC_CHROMIUM_PATH });
  t.after(() => browser.close());
  const page = await browser.newPage();
  return { application, page };
}

async function responses(page: Page) {
  const requests: string[] = [];
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname + url.search);
    const json =
      url.pathname === '/api/projects'
        ? { entries: [project] }
        : url.pathname.endsWith('/goals')
          ? { entries: [{ id: 'fixture-goal' }] }
          : url.pathname.endsWith('/objectives')
            ? { entries: [] }
            : { content: '# Verified goal' };
    return route.fulfill({ json });
  });
  return requests;
}

async function selectProject(page: Page) {
  await page.getByRole('button', { name: 'Project manager' }).click();
  await page.getByLabel('Operator credential').fill('review-fixture');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByLabel('Active project').selectOption(project.id);
  await page.getByRole('button', { name: 'Close' }).click();
}

test('the browser keeps native messages and resumes an interrupted event log', async (t) => {
  const { application, page } = await browserPage(t);
  const cursors: Array<string | undefined> = [];
  await responses(page);
  await page.route('**/plan-executions/current', (route) =>
    route.fulfill({
      json: { execution: 'retained-plan', revision: project.revision, active: true },
    }),
  );
  await page.route('**/plan-executions/retained-plan/events', (route) => {
    const cursor = route.request().headers()['last-event-id'];
    cursors.push(cursor);
    return route.fulfill({
      contentType: 'text/event-stream',
      body: cursor ? timelineRecord('2', 'Closing message') : timelineRecord('1', 'Opening café 🛠'),
    });
  });
  await page.goto(application.url);
  await selectProject(page);
  const timeline = page.getByRole('log', { name: 'Planning events' });
  await timeline.getByText('Opening café 🛠', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await timeline.getByText('Closing message', { exact: true }).waitFor();
  assert.equal(await timeline.getByText('Opening café 🛠', { exact: true }).count(), 1);
  assert.deepEqual(cursors, [undefined, 'cursor-1']);
});

function timelineRecord(sequence: string, text: string) {
  const observation = { nativeEvent: { event: { item: { type: 'agent_message', text } } } };
  const data = JSON.stringify({ sequence, timestamp: null, observation });
  return 'id: cursor-' + sequence + '\nevent: observation\ndata: ' + data + '\n\n';
}
