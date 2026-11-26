import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { Locator, Page } from 'playwright';
import { serveApi } from '../../../api/src/serve.js';
import { browserPage, planData, project } from '../fixtures/plan-browser.js';
import { preferenceRoutes } from '../fixtures/preferences.js';

export const suite = { owner: 'web-app', level: 'acceptance', tags: ['browser'] } as const;

const report = {
  summary: 'Compared the accepted goals.',
  ratings: [
    {
      id: 'fixture-goal',
      alignment: 'strong',
      evidence: 'partial',
      reason: 'Evidence was retained.',
      sources: [],
      observations: [],
    },
  ],
  comparison: ['There is a gap in evidence.'],
  changes: [{ id: 'fixture-goal', content: '# Revised goal' }],
  links: ['fixture-goal'],
  sources: [{ path: 'docs/charter.md', quote: 'Captured charter excerpt.' }],
};

test('Plan can switch from a messages-only timeline to its full log and startup context', async (t) => {
  const opening =
    messageFrame(1) +
    messageFrame(2, undefined, { message: undefined, operation: { name: 'list-files' } });
  const fixture = await gateway(t, opening);
  const { application, page } = await browserPage(t, new URL(fixture.url));
  await preferenceRoutes(page);
  await page.goto(application.url);
  const log = page.getByRole('log', { name: 'Planning events' });
  await log.getByText('Message 1', { exact: true }).waitFor();
  const tabs = page.getByRole('tablist', { name: 'Event log' });
  assert.equal(await tabs.evaluate((list) => getComputedStyle(list).justifyContent), 'center');
  assert.equal(
    await tabs.getByRole('tab', { name: 'Messages' }).getAttribute('aria-selected'),
    'true',
  );
  assert.equal(await log.getByText('1 operation', { exact: true }).count(), 0);
  await tabs.getByRole('tab', { name: 'Full log' }).click();
  await log.getByText('1 operation', { exact: true }).click();
  await log.getByText('list-files', { exact: true }).waitFor();
  await verifyContextFormatting(page);
});

async function verifyContextFormatting(page: Page) {
  await page.getByRole('tab', { name: 'Context', exact: true }).click();
  await page.getByText('Captured model request', { exact: true }).waitFor();
  const tabs = page.getByRole('tablist', { name: 'Model request sections' });
  assert.equal(await tabs.evaluate((list) => getComputedStyle(list).borderBottomStyle), 'solid');
  await page.getByRole('tab', { name: 'Task', exact: true }).click();
  await page.getByText('Recorded Planner instruction.', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await verifyYamlDisclosure(page);
  await page.getByRole('tab', { name: 'Standards', exact: true }).click();
  await page.getByRole('heading', { name: 'Recorded quality standard', exact: true }).waitFor();
}

async function verifyYamlDisclosure(page: Page) {
  const yaml = page.getByRole('tabpanel', { name: 'Activity', exact: true });
  assert.equal(await yaml.evaluate((panel) => getComputedStyle(panel).borderTopStyle), 'solid');
  const settings = yaml.locator('summary').filter({ hasText: 'settings' });
  assert.equal(await settings.count(), 1);
  assert.equal(await yaml.getByText('Verify rubric', { exact: true }).count(), 0);
  await settings.click();
  await yaml.locator('summary').filter({ hasText: 'steps' }).click();
  await yaml.getByText('Verify rubric', { exact: true }).waitFor();
  await settings.click();
  await yaml.getByText('Verify rubric', { exact: true }).waitFor({ state: 'detached' });
  await yaml.getByRole('button', { name: /View source.*YAML source/ }).click();
  const source = page.getByRole('dialog', { name: 'YAML source' });
  await source
    .locator('code.language-yaml')
    .getByText('# Keep this comment', { exact: true })
    .waitFor();
  await source.getByRole('button', { name: 'Close' }).click();
}

test('live metrics and the complete Planner report update with Event log disabled', async (t) => {
  const fixture = await gateway(t);
  const { application, page } = await browserPage(t, new URL(fixture.url));
  await preferenceRoutes(page);
  await page.goto(application.url);
  const outcome = page.getByRole('region', { name: 'Planner outcome' });
  await outcome.getByText('Mapping in progress.', { exact: true }).waitFor();
  await hideEventLog(page);
  fixture.finish();
  assert.equal(await page.getByRole('log', { name: 'Planning events' }).count(), 0);
  await outcome.getByText(report.summary, { exact: true }).waitFor();
  await page.getByText('2.0K / 0.0K', { exact: true }).waitFor();
  await verifyReportTabs(page, outcome);
  assert.equal(await outcome.getByRole('link', { name: 'Issue #746' }).count(), 1);
  assert.equal(await outcome.getByRole('link', { name: 'PR #747' }).count(), 1);
});

test('elapsed clocks advance locally and token history uses recorded reports', async (t) => {
  const fixture = await gateway(t);
  const { application, page } = await browserPage(t, new URL(fixture.url));
  await preferenceRoutes(page);
  await page.clock.install();
  await page.goto(application.url);
  const metrics = page.getByRole('region', { name: 'Planner metrics' });
  await metrics.getByText('00:01:00', { exact: true }).waitFor();
  await page.clock.runFor(1000);
  await metrics.getByText('00:01:01', { exact: true }).waitFor();
  await metrics.getByText('00:00:16', { exact: true }).waitFor();
  const tokens = metrics.getByRole('button', { name: /1\.0K \/ 0\.0K.*Reported tokens/ });
  assert.equal(await tokens.count(), 1);
  assert.equal(await metrics.getByText('Token history', { exact: true }).count(), 0);
  await tokens.click();
  const details = page.getByRole('dialog', { name: 'Reported tokens over time' });
  const samples = details.getByRole('table', { name: 'Cumulative reported tokens' });
  await samples.getByText('1.0K / 0.0K', { exact: true }).waitFor();
});

async function verifyReportTabs(page: Page, outcome: Locator) {
  const tabs = outcome.getByRole('tablist', { name: 'Planner report' });
  assert.equal(await tabs.count(), 1);
  const ratings = tabs.getByRole('tab', { name: 'Ratings', exact: true });
  assert.equal(await ratings.getAttribute('aria-selected'), 'true');
  assert.equal(await outcome.getByRole('tabpanel').count(), 1);
  await ratings.press('ArrowRight');
  await outcome
    .getByRole('tabpanel', { name: 'Comparison' })
    .getByText('There is a gap in evidence.')
    .waitFor();
  await ratings.click();
  await outcome.getByRole('button', { name: /Details.*fixture-goal/ }).click();
  const rating = page.getByRole('dialog', { name: 'Rating for fixture-goal' });
  await rating.getByText('Evidence was retained.', { exact: true }).waitFor();
  await rating.getByRole('button', { name: 'Close' }).click();
  await tabs.getByRole('tab', { name: 'Changes', exact: true }).click();
  await outcome.getByRole('button', { name: /View proposal.*fixture-goal/ }).click();
  const proposal = page.getByRole('dialog', { name: 'Proposed document fixture-goal' });
  await proposal.getByText('# Revised goal').waitFor();
  await proposal.getByRole('button', { name: 'Close' }).click();
  await tabs.getByRole('tab', { name: 'Sources', exact: true }).click();
  await outcome
    .getByRole('tabpanel', { name: 'Sources' })
    .getByText('Captured charter excerpt.')
    .waitFor();
  assert.equal(await outcome.locator('summary').count(), 0);
  assert.equal(await outcome.getByText(report.summary, { exact: true }).isVisible(), true);
}

test('the event log grows with the page and follows new entries only at the tail', async (t) => {
  const opening = Array.from({ length: 40 }, (_, index) => messageFrame(index + 1)).join('');
  const fixture = await gateway(t, opening);
  const { application, page } = await browserPage(t, new URL(fixture.url));
  await preferenceRoutes(page);
  await page.goto(application.url);
  const log = page.getByRole('log', { name: 'Planning events' });
  await log.getByText('Message 40', { exact: true }).waitFor();
  assert.equal(await log.evaluate((item) => getComputedStyle(item).overflowY), 'visible');
  await scrollPage(page, 'end');
  const previous = await page.evaluate(() => scrollY);
  fixture.event(messageFrame(41));
  await log.getByText('Message 41', { exact: true }).waitFor();
  await page.waitForFunction((position) => scrollY > position, previous);
  await scrollPage(page, 'start');
  fixture.event(messageFrame(42));
  await log.getByText('Message 42', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => scrollY), 0);
});

function scrollPage(page: Page, edge: 'start' | 'end') {
  return page.evaluate(
    (position) =>
      new Promise<void>((resolve) => {
        window.addEventListener('scroll', () => resolve(), { once: true });
        window.scrollTo(0, position === 'start' ? 0 : document.documentElement.scrollHeight);
      }),
    edge,
  );
}

for (const [kind, keepHistory] of [
  ['failed', false],
  ['planned', false],
  ['blocked', true],
] as const) {
  test('the same Plan execution opens another journal run after ' + kind, async (t) => {
    const fixture = await gateway(t, messageFrame(1, 201, { outcome: { kind } }));
    const { application, page } = await browserPage(t, new URL(fixture.url));
    await preferenceRoutes(page);
    await page.goto(application.url);
    const log = page.getByRole('log', { name: 'Planning events' });
    const original = log.getByText('Message 1', { exact: true });
    await original.waitFor();
    fixture.event(messageFrame(2, 202));
    await log.getByText('Message 2', { exact: true }).waitFor();
    assert.equal(await original.count(), keepHistory ? 1 : 0);
  });
}

function messageFrame(sequence: number, run?: number, detail?: object) {
  const frame = {
    sequence: String(sequence),
    run,
    taskID: 'plan-live',
    timestamp: null,
    observation: { message: 'Message ' + sequence, ...detail },
  };
  return 'id: cursor-' + sequence + '\nevent: observation\ndata: ' + JSON.stringify(frame) + '\n\n';
}

async function hideEventLog(page: Page) {
  await page.getByRole('button', { name: 'Plan page settings' }).click();
  await page.getByRole('button', { name: 'Remove Event log' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('region', { name: 'Plan page settings' }).waitFor({ state: 'hidden' });
}

async function gateway(t: TestContext, opening = '') {
  let finished = false;
  const notice = 'event: plan-change\ndata: null\n\n';
  const notices = liveFeed(notice);
  const activity = liveFeed(opening);
  const application = await serveApi(async (request) => {
    const path = new URL(request.url).pathname;
    if (
      path.endsWith('/plan-executions') &&
      request.headers.get('accept') === 'text/event-stream'
    ) {
      return notices.response();
    }
    if (path.endsWith('/events')) return activity.response();
    return Response.json(planFixture(path, finished));
  });
  t.after(() => {
    application.server.closeAllConnections();
    application.server.close();
  });
  return {
    url: application.url,
    event: activity.send,
    finish() {
      finished = true;
      notices.send(notice);
    },
  };
}

function liveFeed(opening: string) {
  let changes: ReadableStreamDefaultController<Uint8Array> | undefined;
  const send = (frame: string) => changes?.enqueue(new TextEncoder().encode(frame));
  return {
    send,
    response: () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            changes = controller;
            if (opening) send(opening);
          },
          cancel() {
            changes = undefined;
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      ),
  };
}

function planFixture(path: string, finished: boolean) {
  if (path.endsWith('/plan-executions'))
    return { entries: [{ execution: 'plan-live', revision: project.revision, active: true }] };
  if (path.endsWith('/outcome'))
    return {
      active: true,
      issue: '746',
      pull: { url: 'https://github.com/example/plan/pull/747' },
      outcome: { summary: 'Mapping in progress.' },
      ...(finished && { report }),
    };
  if (path.endsWith('/metrics'))
    return {
      wallElapsedMs: 60000,
      nativeElapsedMs: 15000,
      profiles: [{ activeActivations: 1 }],
      usage: { input_tokens: { reported: finished ? 2000 : 1000 }, output_tokens: { reported: 0 } },
    };
  if (path.endsWith('/token-history'))
    return {
      samples: [{ sequence: '6', timestamp: '2026-11-26T02:30:49.000Z', input: 1000, output: 0 }],
    };
  if (path.endsWith('/context')) return capturedContext;
  return planData('/api' + path);
}

const capturedContext = {
  request: {
    input: [
      '## Task\nSource: Task inputs supplied at activation\n\nRecorded Planner instruction.',
      '## Activity\nSource: planner.yaml (activities.planning)\n\n# Keep this comment\ncomponent: planner\nsettings:\n  steps:\n    - Verify rubric',
      '## Standards\nSource: planner.yaml\n\nSource: docs/quality.md\n--- BEGIN docs/quality.md ---\n# Recorded quality standard\n--- END docs/quality.md ---',
    ].join('\n\n'),
    options: { model: 'fixture-model' },
  },
};
