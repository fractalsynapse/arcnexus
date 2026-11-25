import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page, Route } from 'playwright';
import {
  browserPage,
  otherProject,
  planData,
  project,
  responses,
  selectProject,
} from '../fixtures/plan-browser.js';

export const suite = { owner: 'web-app', level: 'acceptance', tags: ['browser'] } as const;
const previous = { revision: 'b'.repeat(40), updated: '2025-11-24T17:01:23.000Z' };

test('the built Plan opens a pinned file through the shared workspace layout', async (t) => {
  const { application, page } = await browserPage(t);
  const requests = await responses(page, [project, otherProject]);
  await page.goto(application.url);
  await page.reload();
  await selectProject(page);
  const goal = page.getByRole('link', { name: 'fixture-goal' });
  await goal.waitFor();
  assert.ok(
    !requests.some((path) => path.includes('/objectives') || path.includes('/fixture-goal')),
  );
  await goal.click();
  await page.getByRole('heading', { name: 'Verified goal', exact: true }).last().waitFor();
  assert.equal(new URL(page.url()).searchParams.get('project'), project.id);
  await page.reload();
  await page.getByRole('heading', { name: 'Verified goal', exact: true }).last().waitFor();
  await verifyFileHeading(page);
  await verifyFullWidthDiff(page);
  await verifySinglePanelToggle(page);
  assert.ok(
    requests.includes(
      '/api/projects/' + project.id + '/goals/fixture-goal?revision=' + project.revision,
    ),
  );
});

async function verifyFullWidthDiff(page: Page) {
  const diff = page.locator('pre[aria-label="Changes for .arc/goals/fixture-goal.md"]');
  await diff.waitFor();
  const panel = page.locator('.arc-display-body').filter({ has: diff });
  assert.equal(await panel.getByRole('list', { name: 'Changed files' }).count(), 0);
  const [content, body] = await Promise.all([diff.boundingBox(), panel.boundingBox()]);
  assert.ok(content && body && Math.abs(content.width - body.width) < 1);
}

test('a pinned Plan File can switch between its historical and latest approved revisions', async (t) => {
  const { application, page } = await browserPage(t);
  await responses(page, [project, otherProject]);
  await page.route(/\/goals\/fixture-goal(?:\/[^?]+)?\?/, historicalFile);
  const query = new URLSearchParams({ project: project.id, revision: previous.revision });
  await page.goto(application.url + '/plan/files/goals/fixture-goal/?' + query);
  const content = page.locator('article.arc-markdown');
  const revisions = page.getByLabel('File revision');
  const edit = page.getByRole('checkbox', { name: 'Edit' });
  await content.getByRole('heading', { name: 'Captured goal' }).waitFor();
  const pinned = await revisions.inputValue();
  assert.match(await revisions.locator('option:checked').innerText(), /2025.*\(bbbbbbbb\)$/);
  assert.equal(await edit.isDisabled(), true);
  await assertCompactRevisionMenu(page);
  await revisions.selectOption({ label: 'Latest revision (aaaaaaaa)' });
  await content.getByRole('heading', { name: 'Verified goal' }).waitFor();
  assert.equal(await edit.isEnabled(), true);
  await revisions.selectOption(pinned);
  await content.getByRole('heading', { name: 'Captured goal' }).waitFor();
  assert.equal(await edit.isDisabled(), true);
});

async function assertCompactRevisionMenu(page: Page) {
  await page.setViewportSize({ width: 320, height: 800 });
  const selector = page.getByLabel('File revision');
  await selector.click();
  const presentation = await selector.evaluate((field: HTMLSelectElement) => ({
    menuWidth: parseFloat(getComputedStyle(field, '::picker(select)').width),
    fieldWidth: field.getBoundingClientRect().width,
    rows: Array.from(field.options, (option) => getComputedStyle(option).whiteSpace),
    inViewport: Array.from(field.options).every((option) => {
      const { left, right } = option.getBoundingClientRect();
      return left >= 0 && right <= innerWidth;
    }),
  }));
  assert.ok(presentation.menuWidth >= presentation.fieldWidth);
  assert.ok(presentation.rows.every((style) => style === 'nowrap'));
  assert.ok(presentation.inViewport);
  await page.keyboard.press('Escape');
}

async function historicalFile(route: Route) {
  const url = new URL(route.request().url());
  const old = url.searchParams.get('revision') === previous.revision;
  if (url.pathname.endsWith('/revisions')) {
    const current = { revision: project.revision, updated: '2025-11-25T17:01:23.000Z' };
    return route.fulfill({ json: { revisions: old ? [previous] : [current, previous] } });
  }
  const data = planData(url.pathname);
  return route.fulfill({
    json:
      old && !url.pathname.endsWith('/changes')
        ? { ...data, revision: previous.revision, content: '# Captured goal' }
        : data,
  });
}

async function verifyFileHeading(page: Page) {
  const selector = page.locator('.arc-page-heading').getByLabel('File revision');
  assert.equal(await selector.count(), 1);
  assert.equal(
    await selector.locator('option').first().textContent(),
    'Latest revision (aaaaaaaa)',
  );
  assert.equal(await page.getByRole('link', { name: 'Open current capture' }).count(), 0);
  assert.equal(
    await page.locator('.arc-page-context').getByRole('checkbox', { name: 'Edit' }).count(),
    1,
  );
  assert.equal(
    await page.locator('.arc-markdown h1').evaluate((node) => getComputedStyle(node).fontSize),
    '24px',
  );
}

async function verifySinglePanelToggle(page: Page) {
  const expand = page.getByRole('button', { name: 'Expand Content', exact: true });
  const collapse = page.getByRole('button', { name: 'Collapse Content', exact: true });
  const information = page.getByRole('heading', { name: 'File information', exact: true });
  const changes = page.getByRole('heading', { name: 'Changes', exact: true });
  assert.equal(
    await page.getByRole('button', { name: 'Minimize Content', exact: true }).count(),
    0,
  );
  for (const width of [1180, 390]) {
    await page.setViewportSize({ width, height: 800 });
    assert.equal(await expand.getAttribute('aria-expanded'), 'false');
    await expand.click();
    assert.equal(await collapse.getAttribute('aria-expanded'), 'true');
    assert.equal(await information.isVisible(), false);
    assert.equal(await changes.isVisible(), false);
    await collapse.click();
    await information.waitFor();
    await changes.waitFor();
  }
}
