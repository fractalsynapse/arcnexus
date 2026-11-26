import assert from 'node:assert/strict';
import test from 'node:test';
import type { Locator, Page, Route } from 'playwright';
import { chooseOption } from '../fixtures/browser-select.js';
import type { ObjectiveReview } from '../../../../packages/planner/src/objective-review.js';
import type { Receipt } from '../../../../packages/commands/src/browser.js';
import {
  browserPage,
  fixtureGoal,
  fixtureContent,
  project,
  responses,
  selectProject,
} from '../fixtures/plan-browser.js';

export const suite = { owner: 'web-app', level: 'acceptance', tags: ['browser'] } as const;

test('the built command dock submits Plan and answers only the retained question', async (t) => {
  const { application, page } = await browserPage(t);
  const actions = await commandResponses(page);
  await page.goto(application.url);
  await selectProject(page);
  const recommend = page.getByRole('checkbox', { name: 'Recommend objectives' });
  assert.equal(await recommend.isChecked(), true);
  await recommend.uncheck();
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

test('Save submits the selected goal revision and exact draft for review', async (t) => {
  const { application, page } = await browserPage(t);
  const actions = await commandResponses(page);
  await page.goto(application.url);
  await selectProject(page);
  await page.getByRole('link', { name: fixtureGoal.id }).click();
  await page.getByRole('checkbox', { name: 'Edit', exact: true }).check();
  await page.getByRole('button', { name: 'Raw', exact: true }).click();
  await page.locator('.arc-mdx .cm-content').fill('# Updated measure');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Submitted for review.').waitFor();
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

test('Plan defaults to recommendations and reviews selected source-backed drafts in the shared dialog', async (t) => {
  const { application, page } = await browserPage(t);
  const actions = await commandResponses(page, objectiveReviewFixture);
  await page.goto(application.url);
  await selectProject(page);
  assert.equal(
    await page.getByRole('checkbox', { name: 'Recommend objectives' }).isChecked(),
    true,
  );
  await assertPlanOptions(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await selectObjectiveSubset(page);
  const submitted = actions[0]!;
  assert.deepEqual(submitted.body, {
    id: submitted.receipt,
    request: {
      command: 'task_plan',
      mode: 'recommend-objectives',
    },
  });
  assert.deepEqual(actions[1]?.body, {
    gate: 'exact-gate',
    answer: JSON.stringify({
      action: 'approve',
      selected: ['measure-recovery'],
    }),
  });
});

const objectiveReviewFixture: ObjectiveReview = {
  id: 'review',
  summary: 'Documented recovery requirements.',
  revision: project.revision,
  readOnly: false,
  drafts: ['measure-recovery', 'rehearse-recovery'].map((id) => ({
    id,
    title: id,
    category: 'reliability',
    path: '.arc/objectives/reliability/' + id + '.md',
    gap: 'Documented intent is missing from the inventory.',
    before: null,
    content: '---\nid: ' + id + '\n---\n\n# Recovery\n',
    sources: [
      {
        path: 'handbook/operations/recovery.adoc',
        quote: 'Practice recovery and measure downtime.',
      },
    ],
  })),
};

test('an invalid objective edit keeps its review open and is retained when reopened', async (t) => {
  const { application, page } = await browserPage(t);
  await commandResponses(page, objectiveReviewFixture);
  const diagnostic = 'measure-recovery: Include a Markdown body.';
  await page.route('**/commands/*/answer', (route) =>
    route.fulfill({ status: 422, json: { error: diagnostic } }),
  );
  await page.goto(application.url);
  await selectProject(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  const open = await timelineReview(page);
  await open.click();
  const review = page.getByRole('dialog', { name: 'Review objective recommendations' });
  const editor = await editObjectiveSource(review);
  await editor.fill('   ');
  await review.getByRole('button', { name: 'Review revisions' }).click();
  await review.getByRole('alert').getByText(diagnostic).waitFor();
  await review.getByRole('button', { name: 'Close' }).click();
  await open.click();
  assert.equal(await (await editObjectiveSource(review)).textContent(), '   ');
});

async function editObjectiveSource(review: Locator) {
  await review.getByRole('tab', { name: 'Edit wording' }).click();
  await review.getByRole('button', { name: 'Raw', exact: true }).click();
  return review.locator('.arc-mdx .cm-content');
}

async function assertPlanOptions(page: Page) {
  const options = page.getByRole('group', { name: 'Plan options' });
  const recommend = options.getByRole('checkbox', { name: 'Recommend objectives' });
  await recommend.waitFor();
  await chooseOption(page, 'Operation', 'Architect');
  await options.waitFor({ state: 'hidden' });
  await chooseOption(page, 'Operation', 'Plan');
  assert.equal(await recommend.isChecked(), true);
}

async function selectObjectiveSubset(page: Page) {
  const review = await timelineReview(page);
  await review.click();
  const dialog = page.getByRole('dialog', { name: 'Review objective recommendations' });
  await assertObjectiveWording(dialog);
  await dialog.getByText('Approving continues this run into goal refinement.').waitFor();
  const selection = dialog.getByRole('group', { name: 'Drafts to approve' });
  assert.equal(await selection.getByRole('checkbox').count(), 2);
  assert.equal(
    await dialog.getByRole('tabpanel', { name: 'measure-recovery' }).getByRole('checkbox').count(),
    0,
  );
  await selection.getByRole('checkbox', { name: 'rehearse-recovery' }).uncheck();
  await selection.getByText('1 of 2 selected').waitFor();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await review.click();
  await dialog.getByRole('tab', { name: 'rehearse-recovery' }).click();
  assert.equal(
    await selection.getByRole('checkbox', { name: 'rehearse-recovery' }).isChecked(),
    false,
  );
  await dialog.getByRole('button', { name: 'Approve selected' }).click();
  await dialog.waitFor({ state: 'hidden' });
}

async function timelineReview(page: Page) {
  const timeline = page.getByRole('log', { name: 'Planning events' });
  const review = timeline.getByRole('button', {
    name: 'Review objective recommendations',
    exact: true,
  });
  await review.waitFor();
  await assertSingleReviewEntry(timeline);
  await page.getByRole('tab', { name: 'Full log' }).click();
  await review.waitFor();
  await assertSingleReviewEntry(timeline);
  await page.getByRole('tab', { name: 'Messages' }).click();
  assert.equal(
    await page
      .getByRole('contentinfo', { name: 'Command controls' })
      .getByRole('button', { name: 'Review objective recommendations' })
      .count(),
    0,
  );
  assert.equal(await page.getByRole('checkbox', { name: 'Recommend objectives' }).count(), 0);
  return review;
}

async function assertSingleReviewEntry(timeline: Locator) {
  assert.equal(
    await timeline.getByText('Objective recommendations are ready for review').count(),
    0,
  );
  assert.equal(
    await timeline.getByText('Review objective recommendations.', { exact: true }).count(),
    0,
  );
  assert.equal(await timeline.getByText('Documented recovery requirements.').count(), 0);
  assert.equal(await timeline.getByText('Reading project docs', { exact: true }).count(), 1);
}

async function assertObjectiveWording(dialog: Locator) {
  const wording = dialog.getByRole('region', { name: 'Proposed objective' });
  await wording.getByRole('heading', { name: 'Recovery' }).waitFor();
  assert.equal(await wording.getByText('handbook/operations/recovery.adoc').count(), 0);
  assert.equal(await dialog.getByRole('tab', { name: 'Changes' }).count(), 0);
  await dialog.getByText('Supporting information', { exact: true }).click();
  await dialog.getByText('Practice recovery and measure downtime.').waitFor();
  const feedback = dialog.getByLabel('Feedback for a revised proposal');
  const revisions = dialog.getByRole('button', { name: 'Review revisions' });
  assert.equal(await revisions.isEnabled(), false);
  await feedback.fill('Explain how the review is measured.');
  assert.equal(await revisions.isEnabled(), true);
  assert.equal(await dialog.getByRole('button', { name: 'Approve selected' }).isEnabled(), false);
  await feedback.clear();
}

async function commandResponses(page: Page, review?: ObjectiveReview) {
  await responses(page);
  const requests: { body: unknown; receipt: string }[] = [];
  const receipt: Receipt = {
    id: '38882637-979e-4702-a8c7-186d1aa066e8',
    request: { command: 'task_plan' },
    revision: project.revision,
    execution: 'retained-plan',
    state: 'waiting',
    gate: {
      id: 'exact-gate',
      question: review ? 'Review objective recommendations' : 'Approve this proposed change?',
      review,
    },
    outcome: null,
  };
  await commandStreamFixture(page);
  if (review) await objectiveTimeline(page, receipt);
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

async function objectiveTimeline(page: Page, receipt: Receipt) {
  const execution = receipt.execution;
  await page.route('**/plan-executions', (route) =>
    route.fulfill({
      json: { entries: [{ execution, revision: receipt.revision, active: false }] },
    }),
  );
  await page.route('**/plan-executions/retained-plan/events', (route) => {
    const { question, review } = receipt.gate!;
    const observations = [
      { phase: 'planning', message: 'Reading project docs' },
      { clarification: { question, review } },
      { phase: 'question', message: 'Objective recommendations are ready for review' },
      { outcome: { kind: 'blocked', reason: 'Review objective recommendations.' } },
    ];
    return route.fulfill({
      contentType: 'text/event-stream',
      body: observations.map(objectiveFrame).join(''),
    });
  });
}

function objectiveFrame(observation: object, index: number) {
  const frame = { sequence: String(index + 1), timestamp: null, observation };
  return `id: ${frame.sequence}\nevent: observation\ndata: ${JSON.stringify(frame)}\n\n`;
}

async function commandStreamFixture(page: Page) {
  await page.route('**/commands/current', (route) =>
    route.fulfill({
      contentType: 'text/event-stream',
      body: 'event: command\ndata: {"canSubmit":true,"receipt":null}\n\n',
    }),
  );
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
