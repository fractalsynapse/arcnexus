import assert from 'node:assert/strict';
import { get } from 'node:http';
import test, { type TestContext } from 'node:test';
import type { Page, Route } from 'playwright';
import type { Receipt } from '../../../../packages/commands/src/browser.js';
import {
  browserPage,
  fixtureGoal,
  fixtureContent,
  otherProject,
  planData,
  project,
  responses,
  selectProject,
  verifyTokenTotals,
} from '../fixtures/plan-browser.js';
import { serveApi } from '../../../api/src/serve.js';
import { serveWeb } from '../../src/serve.js';
import { chooseOption, openSelect } from '../fixtures/browser-select.js';

export const suite = { owner: 'web-app', level: 'acceptance', tags: ['browser'] } as const;

test('the local Web proxy supplies the operator only for the local browser', async (t) => {
  const forwarded: (string | null)[] = [];
  const gateway = await serveApi(async (request) => {
    forwarded.push(request.headers.get('authorization'));
    return Response.json({ entries: [project] });
  });
  t.after(() => gateway.server.close());
  const operator = { credential: 'server-only-fixture' };
  const api = new URL(gateway.url);
  const application = await serveWeb('dist/apps/web/site', 0, '127.0.0.1', api, operator);
  t.after(() => application.server.close());
  const route = application.url + '/api/projects';
  const visible = await fetch(route);
  assert.deepEqual(await visible.json(), { entries: [project] });
  assert.equal(visible.headers.get('cache-control'), 'no-store');
  await rejectForeignBrowser(route);
  assert.deepEqual(forwarded, ['Bearer server-only-fixture']);
  await assert.rejects(
    serveWeb('dist/apps/web/site', 0, '0.0.0.0', api, operator),
    /loopback origin/,
  );
});

async function rejectForeignBrowser(route: string) {
  const response = await fetch(route, {
    method: 'POST',
    headers: { origin: 'http://untrusted.example', 'sec-fetch-site': 'cross-site' },
  });
  assert.equal(response.status, 403);
  const rebound = await new Promise<number | undefined>((resolve, reject) => {
    get(route, { headers: { host: 'untrusted.example' } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(rebound, 403);
}

test('Plan history keeps the header and all displays scoped to the selected project and run', async (t) => {
  const { application, page } = await browserPage(t, undefined, {
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });
  const requests = await responses(page, [project, otherProject]);
  await historyResponses(page, requests);
  await page.goto(application.url);
  await selectProject(page);
  const selector = page.getByRole('combobox', { name: 'Plan run' });
  await page.getByText('Latest outcome', { exact: true }).waitFor();
  await assertRunRange(page, '11/25/2025: 12:01:23 PM - 12:04:23 PM');
  await assertTokenTooltip(page);
  assert.equal(await selector.count(), 1);
  assert.equal(await selector.textContent(), 'Latest run');
  await chooseOption(page, 'Plan run', /11\/24\/2025/);
  await assertHistoricalPlan(page, requests);
  assert.ok(!requests.some((path) => path.endsWith('/token-history')));
  await verifyTokenTotals(page, '977.0K / 15.2K', 2, '123.4K / —');
  await selectProject(page, otherProject.id);
  await page.getByText('Other outcome', { exact: true }).waitFor();
  await verifyTokenTotals(page, '7.0K / 1.0K', 1);
  assert.equal(await selector.textContent(), 'Latest run');
  const menu = await openSelect(page, 'Plan run');
  assert.equal(await menu.getByRole('option', { name: /11\/24\/2025/ }).count(), 0);
  assert.ok(!requests.some((path) => path.includes('/other-project/plan-executions/earlier')));
});

const earlier = {
  execution: 'earlier',
  revision: 'b'.repeat(40),
  active: false,
  startedAt: '2025-11-24T17:01:23.000Z',
  updatedAt: '2025-11-25T05:04:23.000Z',
};
const latest = {
  ...earlier,
  execution: 'latest',
  revision: project.revision,
  startedAt: '2025-11-25T17:01:23.000Z',
  updatedAt: '2025-11-25T17:04:23.000Z',
};

async function historyResponses(page: Page, requests: string[]) {
  await page.route('**/plan-executions**', respondToPlanHistory);
  await page.route('**/token-history', (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const [input, output] = path.includes('/other-project/')
      ? [7000, 1000]
      : path.includes('/earlier/')
        ? [123400, null]
        : [853600, 15200];
    const samples = [
      { input: 500, output: output === null ? null : 40 },
      { input, output },
    ];
    return route.fulfill({ json: { samples } });
  });
}

function respondToPlanHistory(route: Route) {
  const path = new URL(route.request().url()).pathname;
  const other = path.includes('/other-project/');
  const selected = path.includes('/earlier/') ? earlier : latest;
  if (path.endsWith('/plan-executions'))
    return route.fulfill({ json: { entries: other ? [latest] : [latest, earlier] } });
  if (path.endsWith('/current')) return route.fulfill({ json: latest });
  if (path.endsWith('/metrics'))
    return route.fulfill({
      json: { usage: { input_tokens: { reported: 853600 }, output_tokens: { reported: 15200 } } },
    });
  if (path.endsWith('/events'))
    return route.fulfill({
      contentType: 'text/event-stream',
      body: timelineRecord('1', selected.execution + ' message'),
    });
  const summary = other
    ? 'Other outcome'
    : selected === earlier
      ? 'Earlier outcome'
      : 'Latest outcome';
  return route.fulfill({ json: { ...selected, outcome: { kind: 'planned', summary } } });
}

async function assertTokenTooltip(page: Page) {
  await page.getByText('853.6K / 15.2K', { exact: true }).hover();
  await page
    .locator('.arc-tooltip:popover-open')
    .filter({ hasText: 'Input / output tokens' })
    .waitFor();
}

async function assertHistoricalPlan(page: Page, requests: string[]) {
  await page.getByText('Earlier outcome', { exact: true }).waitFor();
  await page.getByText('earlier message', { exact: true }).waitFor();
  assert.equal(await page.getByText('latest message', { exact: true }).count(), 0);
  assert.ok(requests.some((path) => path.endsWith('/goals?revision=' + earlier.revision)));
  await assertPlanHeading(page, 1180);
  await assertPlanHeading(page, 320);
  await assertRunRange(page, '11/24/2025: 12:01:23 PM - 11/25/2025: 12:04:23 AM');
  const label = page.locator('.arc-page-context strong', { hasText: 'plan' });
  assert.equal(await label.evaluate((node) => getComputedStyle(node).fontWeight), '700');
}

async function assertRunRange(page: Page, range: string) {
  const context = page.locator('.arc-page-context');
  const times = context.locator('time');
  assert.equal(await times.count(), 2);
  assert.equal((await context.innerText()).replace(/\s+/g, ' ').trim(), 'plan ' + range);
}

async function assertPlanHeading(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  const gear = await page
    .getByRole('button', { name: 'Plan page settings' })
    .locator('svg')
    .boundingBox();
  const title = await page.getByRole('heading', { name: 'Plan', exact: true }).boundingBox();
  const selector = await page.getByRole('combobox', { name: 'Plan run' }).boundingBox();
  const context = await page.locator('.arc-page-context').boundingBox();
  assert.ok(gear && title && selector && context);
  const gearGap = title.x - (gear.x + gear.width);
  const selectorGap = selector.x - (title.x + title.width);
  assert.ok(Math.abs(gearGap - selectorGap) < 1, 'Title spacing should match on both sides');
  assert.ok(title.y < selector.y + selector.height && selector.y < title.y + title.height);
  if (width === 1180)
    assert.ok(selector.width >= 346, 'Desktop run selector should have room for dates');
  else {
    assert.ok(context.y >= selector.y + selector.height);
    assert.ok(title.height < selector.height, 'Plan should stay on one line at mobile width');
  }
  assert.ok(selector.x + selector.width <= width);
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
  await page.getByRole('tab', { name: 'Full log', exact: true }).click();
  await timeline.getByText('1 operation', { exact: true }).click();
  await timeline.getByText('Passed', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Reconnect', exact: true }).click();
  await timeline.getByText('Closing message', { exact: true }).waitFor();
  assert.equal(await timeline.getByText('Opening café 🛠', { exact: true }).count(), 1);
  assert.deepEqual(cursors, [undefined, 'cursor-2']);
});

async function timelineResponses(page: Page, cursors: Array<string | undefined>) {
  await page.route('**/plan-executions', (route) =>
    route.fulfill({
      json: { entries: [{ execution: 'retained-plan', revision: project.revision, active: true }] },
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

test('an open tool inspector loads input on demand and refreshes when the live result commits', async (t) => {
  const fixture = await liveToolFixture(t);
  const { application, page } = await browserPage(t, new URL(fixture.url));
  await page.goto(application.url);
  await selectProject(page);
  const timeline = page.getByRole('log', { name: 'Planning events' });
  await page.getByRole('tab', { name: 'Full log', exact: true }).click();
  await timeline.getByText('1 operation', { exact: true }).click();
  assert.equal(fixture.reads(), 0);
  await timeline.getByRole('button', { name: 'read-file inputs and outputs' }).click();
  const detail = page.getByRole('dialog', { name: 'read-file inputs and outputs' });
  await detail.getByRole('heading', { name: 'Input', exact: true }).waitFor();
  await detail.locator('section').filter({ hasText: 'Input' }).locator('summary').nth(1).click();
  await detail.getByText('".arc/goals/fixture-goal.md"', { exact: true }).waitFor();
  fixture.finish();
  await detail.getByRole('heading', { name: 'Output', exact: true }).waitFor();
  assert.equal(
    await timeline.locator('[data-operation-state="passed"]').getByText('Completed').count(),
    1,
  );
  assert.equal(fixture.reads(), 2);
});

async function liveToolFixture(t: TestContext) {
  const args = { path: '.arc/goals/fixture-goal.md' };
  const result = { content: [{ type: 'text', text: 'Recorded tool output' }] };
  const input = { phase: 'started', args };
  const output = { phase: 'completed', result };
  let reads = 0;
  let completed = false;
  const updates = liveToolUpdates();
  const application = await serveApi(async (request) =>
    liveToolResponse(new URL(request.url).pathname, {
      entries: () => {
        reads += 1;
        return completed ? [input, output] : [input];
      },
      events: updates.events,
    }),
  );
  t.after(() => application.server.close());
  return {
    ...application,
    reads: () => reads,
    finish() {
      completed = true;
      updates.finish();
    },
  };
}

function liveToolUpdates() {
  let stream: ReadableStreamDefaultController;
  return {
    events: () =>
      new ReadableStream({
        start(controller) {
          stream = controller;
          controller.enqueue(Buffer.from(toolFrame('1', 'started')));
        },
      }),
    finish: () => stream.enqueue(Buffer.from(toolFrame('2', 'completed'))),
  };
}

function liveToolResponse(
  path: string,
  fixture: { entries(): unknown[]; events(): ReadableStream },
) {
  if (path.endsWith('/plan-executions'))
    return Response.json({
      entries: [{ execution: 'live-plan', revision: project.revision, active: true }],
    });
  if (path.endsWith('/live-plan/events'))
    return new Response(fixture.events(), { headers: { 'content-type': 'text/event-stream' } });
  if (path.endsWith('/operation-evidence/1')) return Response.json({ entries: fixture.entries() });
  return Response.json(planData('/api' + path));
}

function toolFrame(sequence: string, phase: string) {
  return timelineFrame(sequence, {
    operation: { name: 'read-file', call: 'recorded-call', phase },
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
  await page.getByRole('button', { name: 'Stop Plan', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Send', exact: true }).count(), 0);
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

test('the composer stops its active receipt and restores Send after cancellation', async (t) => {
  const { application, page } = await browserPage(t);
  const actions = await commandResponses(page);
  await page.goto(application.url);
  await selectProject(page);
  const send = page.getByRole('button', { name: 'Send', exact: true });
  const footer = page.getByRole('contentinfo', { name: 'Command controls' });
  await footer.getByRole('button', { name: 'Reconnect command updates', exact: true }).waitFor();
  assert.equal(await footer.getByText('Command updates disconnected.').count(), 0);
  await send.click();
  await page.getByRole('button', { name: 'Stop Plan', exact: true }).click();
  await send.waitFor();
  assert.equal(await send.isEnabled(), true);
  assert.equal(actions[1]?.receipt, actions[0]?.receipt);
  assert.equal(actions[1]?.body, 'cancel');
});

async function commandResponses(page: Page) {
  await responses(page);
  const requests: { body: unknown; receipt: string }[] = [];
  const receipt: Receipt = {
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
  await page.route('**/commands/*/{answer,cancel}', (route) =>
    commandActionResponse(route, receipt, requests),
  );
  return requests;
}

function commandActionResponse(
  route: Route,
  receipt: Receipt,
  requests: { body: unknown; receipt: string }[],
) {
  const [, id, action] = new URL(route.request().url()).pathname.split('/').slice(-3);
  const cancel = action === 'cancel';
  requests.push({ body: cancel ? action : route.request().postDataJSON(), receipt: id! });
  const result = cancel
    ? { state: 'finished', outcome: { kind: 'cancelled' } }
    : { state: 'queued' };
  return route.fulfill({ json: { ...receipt, ...result, gate: null }, status: 202 });
}

test('the Connection manager downloads only an available launcher build', async (t) => {
  const { application, page } = await browserPage(t);
  await responses(page);
  await page.route('**/api/launcher-builds', (route) =>
    route.fulfill({ json: { entries: [{ target: 'linux-x64', sha256: 'a'.repeat(64) }] } }),
  );
  await page.route('**/api/capacity-providers/codes', (route) =>
    route.fulfill({ json: { code: 'REVIEW-FIXTURE' } }),
  );
  await page.goto(application.url);
  await selectProject(page);
  await page.getByRole('button', { name: 'Connection manager' }).click();
  await page
    .getByText('No capacity providers connected.', { exact: true })
    .waitFor({ state: 'visible' });
  await chooseOption(page, 'Launcher build', 'Linux · x64');
  const link = page.getByRole('link', { name: 'Download launcher' });
  assert.equal(await link.getAttribute('href'), '/api/launcher-builds/linux-x64');
  await chooseOption(page, 'Launcher build', 'Linux · ARM64');
  assert.equal(await link.count(), 0);
  await verifyRegistrationCode(page);
});

async function verifyRegistrationCode(page: Page) {
  const manager = page.getByRole('button', { name: 'Connection manager', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Connection manager', exact: true });
  const code = dialog.getByText('REVIEW-FIXTURE', { exact: true });
  await dialog.getByRole('button', { name: 'Create registration code', exact: true }).click();
  await code.waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await manager.click();
  await code.waitFor();
}

test('the Project manager keeps reachability with status and uses a compact import action', async (t) => {
  const { application, page } = await browserPage(t);
  await responses(page);
  await page.goto(application.url);
  await selectProject(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole('button', { name: 'Project manager' }).click();
  const dialog = page.getByRole('dialog', { name: 'Project manager' });
  await dialog.getByLabel('Active project').waitFor();
  assert.equal(await dialog.getByPlaceholder('https://github.com/owner/repository').count(), 1);
  const reach = dialog.getByRole('button', { name: 'Check reachability', exact: true });
  assert.equal(
    await reach.evaluate((control) => !!control.closest('.arc-management-record')),
    true,
  );
  assert.equal(await dialog.getByRole('button', { name: 'Remove plan', exact: true }).count(), 1);
});
