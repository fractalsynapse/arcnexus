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

test('live event log follows the tail and lets the reader scroll back', async (t) => {
  const opening = Array.from({ length: 40 }, (_, index) => messageFrame(index + 1)).join('');
  const fixture = await gateway(t, opening);
  const { application, page } = await browserPage(t, new URL(fixture.url));
  await preferenceRoutes(page);
  await page.goto(application.url);
  const log = page.getByRole('log', { name: 'Planning events' });
  await log.getByText('Message 40', { exact: true }).waitFor();
  const atTail = () =>
    log.evaluate((item) => Math.ceil(item.scrollTop + item.clientHeight) >= item.scrollHeight);
  assert.equal(await atTail(), true);
  fixture.event(messageFrame(41));
  await log.getByText('Message 41', { exact: true }).waitFor();
  assert.equal(await atTail(), true);
  await log.evaluate(
    (item) =>
      new Promise<void>((resolve) => {
        item.addEventListener('scroll', () => resolve(), { once: true });
        item.scrollTop = 0;
      }),
  );
  fixture.event(messageFrame(42));
  await log.getByText('Message 42', { exact: true }).waitFor();
  assert.equal(await log.evaluate((item) => item.scrollTop), 0);
});

function messageFrame(sequence: number) {
  const frame = {
    sequence: String(sequence),
    timestamp: null,
    observation: { message: 'Message ' + sequence },
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
      usage: { input_tokens: { reported: finished ? 2000 : 1000 }, output_tokens: { reported: 0 } },
    };
  return planData('/api' + path);
}
