import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { Page } from 'playwright';
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
  for (const section of ['Ratings', 'Comparison', 'Proposed changes', 'Goal links', 'Sources'])
    assert.equal(await outcome.getByRole('heading', { name: section, exact: true }).count(), 1);
  assert.equal(await outcome.getByRole('link', { name: 'Issue #746' }).count(), 1);
  assert.equal(await outcome.getByRole('link', { name: 'PR #747' }).count(), 1);
});

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
