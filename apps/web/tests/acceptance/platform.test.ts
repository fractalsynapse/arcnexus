import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { chromium, type Page } from 'playwright';
import { serveWeb } from '../../src/serve.js';

export const suite = { owner: 'web-app', level: 'acceptance', tags: ['browser'] } as const;

const project = {
  id: 'bound-project',
  remote: 'https://github.com/example/plan.git',
  revision: 'a'.repeat(40),
};

test('the built Plan opens a pinned file through the shared workspace layout', async (t) => {
  const { application, page } = await browserPage(t);
  const requests = await responses(page);
  await page.goto(application.url);
  await selectProject(page);
  const goal = page.getByRole('link', { name: 'fixture-goal' });
  await goal.waitFor();
  assert.ok(
    !requests.some((path) => path.includes('/objectives') || path.includes('/fixture-goal')),
  );
  await goal.click();
  await page.getByRole('heading', { name: 'Verified goal', exact: true }).last().waitFor();
  await page.getByRole('button', { name: 'Expand Content' }).click();
  assert.equal(await page.getByRole('heading', { name: 'Changes' }).isVisible(), false);
  await page.getByRole('button', { name: 'Restore Content' }).click();
  await page.getByRole('heading', { name: 'Changes' }).waitFor();
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
    if (url.pathname === '/api/capacity-providers') return route.fulfill({ json: [] });
    return route.fulfill({ json: planData(url.pathname) });
  });
  return requests;
}

const fixtureGoal = { id: 'fixture-goal', path: '.arc/goals/fixture-goal.md', priority: 1 };
const fixtureContent = '---\npriority: 1\n---\n\n# Verified goal';

function planData(path: string) {
  if (path === '/api/projects') return { entries: [project] };
  if (path.endsWith('/current'))
    return { revision: project.revision, execution: null, active: false };
  if (path.endsWith('/goals')) return { revision: project.revision, entries: [fixtureGoal] };
  if (path.endsWith('/objectives')) return { entries: [] };
  if (path.endsWith('/revisions')) return { revisions: [] };
  if (path.endsWith('/changes'))
    return { path: fixtureGoal.path, before: '# Previous', after: '# Verified goal' };
  return { revision: project.revision, entry: fixtureGoal, content: fixtureContent };
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
  await timelineResponses(page, cursors);
  await page.goto(application.url);
  await selectProject(page);
  const timeline = page.getByRole('log', { name: 'Planning events' });
  await timeline.getByText('Opening café 🛠', { exact: true }).waitFor();
  await timeline.getByText('1 operation', { exact: true }).click();
  await timeline.getByText('Passed', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await timeline.getByText('Closing message', { exact: true }).waitFor();
  assert.equal(await timeline.getByText('Opening café 🛠', { exact: true }).count(), 1);
  assert.deepEqual(cursors, [undefined, 'cursor-2']);
});

async function timelineResponses(page: Page, cursors: Array<string | undefined>) {
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
      body: cursor
        ? timelineRecord('3', 'Closing message')
        : timelineRecord('1', 'Opening café 🛠') +
          timelineFrame('2', { check: { id: 'repository-tests', status: 0 } }),
    });
  });
}

function timelineRecord(sequence: string, text: string) {
  const observation = { nativeEvent: { event: { item: { type: 'agent_message', text } } } };
  return timelineFrame(sequence, observation);
}

function timelineFrame(sequence: string, observation: object) {
  const data = JSON.stringify({ sequence, timestamp: null, observation });
  return 'id: cursor-' + sequence + '\nevent: observation\ndata: ' + data + '\n\n';
}

test('the built command dock submits Plan and answers only the retained question', async (t) => {
  const { application, page } = await browserPage(t);
  const actions = await commandResponses(page);
  await page.goto(application.url);
  await selectProject(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Answer question', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Answer question' });
  await dialog.getByText('Approve this proposed change?').waitFor();
  await dialog.getByLabel('Answer').fill('Use the verified baseline.');
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Answer question', exact: true }).click();
  assert.equal(await dialog.getByLabel('Answer').inputValue(), 'Use the verified baseline.');
  await dialog.getByRole('button', { name: 'Send answer' }).click();
  await page
    .getByRole('button', { name: 'Answer question', exact: true })
    .waitFor({ state: 'hidden' });
  assert.deepEqual(
    actions.map((action) => action.body),
    [
      { id: actions[0]?.receipt, request: { command: 'task_plan' } },
      { gate: 'exact-gate', answer: 'Use the verified baseline.' },
    ],
  );
});

test('Save submits the selected goal revision and exact draft for approval', async (t) => {
  const { application, page } = await browserPage(t);
  const actions = await commandResponses(page);
  await page.goto(application.url);
  await selectProject(page);
  await page.getByRole('link', { name: fixtureGoal.id }).click();
  await page.getByRole('checkbox', { name: 'Edit', exact: true }).check();
  await page.getByRole('button', { name: 'Raw', exact: true }).click();
  await page.locator('.arc-mdx .cm-content').fill('# Updated measure');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Submitted for approval.').waitFor();
  assert.deepEqual(
    actions.map((action) => action.body),
    [
      {
        id: actions[0]?.receipt,
        request: {
          command: 'task_plan',
          draft: {
            id: fixtureGoal.id,
            revision: project.revision,
            content: fixtureContent.replace('\n# Verified goal', '# Updated measure'),
          },
        },
      },
    ],
  );
});

async function commandResponses(page: Page) {
  await responses(page);
  const requests: { body: unknown; receipt: string }[] = [];
  const receipt = {
    id: '38882637-979e-4702-a8c7-186d1aa066e8',
    request: { command: 'task_plan' },
    revision: project.revision,
    execution: 'retained-plan',
    state: 'waiting',
    gate: { id: 'exact-gate', question: 'Approve this proposed change?' },
    outcome: null,
  };
  await page.route('**/commands/current', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: command\ndata: {"canSubmit":true,"receipt":null}\n\n',
    }),
  );
  await page.route('**/commands', (route) => {
    const body = route.request().postDataJSON() as { id: string };
    receipt.id = body.id;
    requests.push({ body, receipt: body.id });
    return route.fulfill({ json: receipt, status: 202 });
  });
  await page.route('**/commands/*/answer', (route) => {
    requests.push({ body: route.request().postDataJSON(), receipt: receipt.id });
    return route.fulfill({ json: { ...receipt, state: 'queued', gate: null }, status: 202 });
  });
  return requests;
}

test('the Connection manager downloads only an available launcher build', async (t) => {
  const { application, page } = await browserPage(t);
  await responses(page);
  await page.route('**/api/launcher-builds', (route) =>
    route.fulfill({ json: { entries: [{ target: 'linux-x64', sha256: 'a'.repeat(64) }] } }),
  );
  await page.goto(application.url);
  await selectProject(page);
  await page.getByRole('button', { name: 'Connection manager' }).click();
  await page.getByLabel('Launcher build').selectOption('linux-x64');
  const link = page.getByRole('link', { name: 'Download launcher' });
  assert.equal(await link.getAttribute('href'), '/api/launcher-builds/linux-x64');
  await page.getByLabel('Launcher build').selectOption('linux-arm64');
  assert.equal(await link.count(), 0);
});
