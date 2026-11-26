import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page, Route } from 'playwright';
import { chooseOption, openSelect } from '../fixtures/browser-select.js';
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

test('File Explorer labels both guide types with paths relative to their collection', async (t) => {
  const { application, page } = await browserPage(t);
  await responses(page, [project]);
  await page.route('**/objectives?**', (route) =>
    route.fulfill({
      json: {
        revision: project.revision,
        entries: [
          {
            id: 'design-rules',
            path: 'knowledge/objectives/design/api/design-rules.md',
            category: 'design/api',
          },
          {
            id: 'legacy',
            path: 'knowledge/objectives/' + 'a'.repeat(64) + '.md',
            name: 'Legacy objective',
          },
        ],
      },
    }),
  );
  await page.goto(application.url);
  await page.getByRole('link', { name: 'fixture-goal.md', exact: true }).waitFor();
  await chooseOption(page, 'File type', 'Objectives');
  await page.getByRole('link', { name: 'design/api/design-rules.md', exact: true }).waitFor();
  await page.getByRole('link', { name: 'a'.repeat(64) + '.md', exact: true }).waitFor();
});

test('inner workspace Back follows in-app history and deep links fall back to Plan', async (t) => {
  const { application, page } = await browserPage(t);
  await responses(page, [project]);
  await page.goto(application.url + '/plan/?view=history');
  const header = page.getByRole('banner');
  const refine = header.getByRole('button', { name: 'Refine', exact: true });
  const back = header.getByRole('button', { name: 'Back', exact: true });
  await refine.waitFor();
  await page.getByRole('link', { name: 'fixture-goal' }).click();
  assert.equal(await refine.count(), 0);
  await back.click();
  await page.waitForURL('**/plan/?view=history');
  await refine.waitFor();
  await page.goto(application.url + '/plan/files/goals/fixture-goal/');
  await back.click();
  await page.waitForURL('**/plan/');
});

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
  await verifyHeadingSpacing(page);
  await verifyFullWidthDiff(page);
  await verifySinglePanelToggle(page);
  assert.ok(
    requests.includes(
      '/api/projects/' + project.id + '/goals/fixture-goal?revision=' + project.revision,
    ),
  );
});

test('Plan File uses editable full-width and column regions on desktop', async (t) => {
  const { application, page } = await browserPage(t);
  await responses(page, [project]);
  await page.goto(application.url + '/plan/files/goals/fixture-goal/');
  const information = filePanel(page, 'File information');
  const content = filePanel(page, 'Content');
  const layout = page.locator('.arc-panel-layout');
  await information.waitFor();
  await assertPanelWidth(information, layout);
  await placeFileInformation(page, 'Top', 'Left');
  await assertPanelWidth(information, content);
  await placeFileInformation(page, 'Left', 'Bottom');
  await page.reload();
  await information.waitFor();
  await assertPanelWidth(information, layout);
  const changes = await filePanel(page, 'Changes').boundingBox();
  const bottom = await information.boundingBox();
  assert.ok(changes && bottom && bottom.y > changes.y + changes.height);
  await page.setViewportSize({ width: 360, height: 800 });
  assert.ok((await information.boundingBox())!.y < (await content.boundingBox())!.y);
  await page.getByRole('button', { name: 'Expand File information' }).click();
  assert.equal(await content.isVisible(), false);
  await page.getByRole('button', { name: 'Collapse File information' }).click();
  await content.waitFor();
});

function filePanel(page: Page, name: string) {
  return page.getByRole('region', { name, exact: true });
}

async function assertPanelWidth(panel: ReturnType<typeof filePanel>, reference: typeof panel) {
  const [box, expected] = await Promise.all([panel.boundingBox(), reference.boundingBox()]);
  assert.ok(box && expected && Math.abs(box.width - expected.width) < 1);
}

async function placeFileInformation(page: Page, from: string, to: string) {
  await page.getByRole('button', { name: 'Plan file page settings', exact: true }).click();
  const placement = page.getByLabel('File information region');
  assert.equal(await placement.textContent(), from);
  await chooseOption(page, 'File information region', to);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('region', { name: 'Plan file page settings' }).waitFor({ state: 'hidden' });
}

async function verifyHeadingSpacing(page: Page) {
  const original = page.viewportSize();
  for (const width of [1180, 360]) {
    await page.setViewportSize({ width, height: 800 });
    const alignment = await page.locator('.arc-main').evaluate((main) => {
      const box = (selector: string) => main.querySelector(selector)!.getBoundingClientRect();
      const center = (selector: string) => {
        const { top, height } = box(selector);
        return top + height / 2;
      };
      return {
        gap: box('.arc-page-title').top - box('.arc-file-breadcrumbs').bottom,
        spacing: parseFloat(getComputedStyle(main).getPropertyValue('--gap')),
        centers: [
          '.arc-page-title .arc-icon-button',
          '.arc-page-title h1',
          '.arc-page-title [role=combobox]',
        ].map(center),
      };
    });
    assert.ok(Math.abs(alignment.gap - alignment.spacing) < 1);
    assert.ok(alignment.centers.every((center) => Math.abs(center - alignment.centers[0]!) < 1));
  }
  if (original) await page.setViewportSize(original);
}

async function verifyFullWidthDiff(page: Page) {
  const diff = page.locator('pre[aria-label="Changes for .arc/goals/fixture-goal.md"]');
  await diff.waitFor();
  const panel = page.locator('.arc-display-body').filter({ has: diff });
  assert.equal(await panel.getByRole('list', { name: 'Changed files' }).count(), 0);
  const [content, available] = await Promise.all([
    diff.boundingBox(),
    panel.evaluate((body) => {
      const { paddingInlineStart, paddingInlineEnd } = getComputedStyle(body);
      return body.clientWidth - parseFloat(paddingInlineStart) - parseFloat(paddingInlineEnd);
    }),
  ]);
  assert.ok(content && Math.abs(content.width - available) < 1);
}

test('Plan File shows numbered change hunks with three context lines on either side', async (t) => {
  const { application, page } = await browserPage(t);
  await responses(page);
  const before = Array.from({ length: 25 }, (_, index) => 'line ' + (index + 1));
  const after = [...before];
  after.splice(17, 1);
  after.splice(5, 1, 'replacement', 'inserted');
  await page.route('**/changes?**', (route) =>
    route.fulfill({
      json: {
        path: '.arc/goals/fixture-goal.md',
        before: before.join('\n'),
        after: after.join('\n'),
      },
    }),
  );
  await page.goto(application.url + '/plan/files/goals/fixture-goal/');
  const diff = filePanel(page, 'Changes').locator('pre');
  await diff.waitFor();
  assert.deepEqual(await diff.locator('[data-change="hunk"]').allTextContents(), [
    '@@ -3,7 +3,8 @@',
    '@@ -15,7 +16,6 @@',
  ]);
  assert.ok(!(await diff.textContent())!.match(/\bline (1|2|10|14|22|25)\b/));
  const replacement = diff.locator('[data-change="added"]').filter({ hasText: 'replacement' });
  const removal = diff.locator('[data-change="removed"]').filter({ hasText: /line 18\b/ });
  assert.deepEqual(await replacement.locator('.arc-diff-number').allTextContents(), ['', '6']);
  assert.deepEqual(await removal.locator('.arc-diff-number').allTextContents(), ['18', '']);
});

test('a pinned Plan File can switch between its historical and latest approved revisions', async (t) => {
  const { application, page } = await browserPage(t, undefined, { hasTouch: true, isMobile: true });
  await responses(page, [project, otherProject]);
  await page.route(/\/goals\/fixture-goal(?:\/[^?]+)?\?/, historicalFile);
  const query = new URLSearchParams({ project: project.id, revision: previous.revision });
  await page.goto(application.url + '/plan/files/goals/fixture-goal/?' + query);
  const content = page.locator('article.arc-markdown');
  const revisions = page.getByLabel('File revision');
  const edit = page.getByRole('checkbox', { name: 'Edit' });
  await content.getByRole('heading', { name: 'Captured goal' }).waitFor();
  const pinned = await revisions.innerText();
  assert.match(pinned, /2025.*\(bbbbbbbb\)$/);
  assert.equal(await edit.isDisabled(), true);
  await verifyRevisionTooltip(page);
  await assertCompactRevisionMenu(page);
  await chooseOption(page, 'File revision', 'Latest revision (aaaaaaaa)');
  await content.getByRole('heading', { name: 'Verified goal' }).waitFor();
  await verifyMobileEdit(page);
  await chooseOption(page, 'File revision', pinned);
  await content.getByRole('heading', { name: 'Captured goal' }).waitFor();
  assert.equal(await edit.isDisabled(), true);
});

async function verifyRevisionTooltip(page: Page) {
  const anchor = page
    .locator('.arc-icon-wrap')
    .filter({ has: page.getByRole('checkbox', { name: 'Edit', exact: true }) });
  const hint = page
    .locator('.arc-tooltip:popover-open')
    .filter({ hasText: 'Historical revisions are read-only. Select Latest revision to edit.' });
  await anchor.hover();
  await hint.waitFor();
  await page.mouse.move(0, 0);
  await hint.waitFor({ state: 'hidden' });
  await page.setViewportSize({ width: 320, height: 800 });
  await anchor.tap();
  await hint.waitFor();
}

async function verifyMobileEdit(page: Page) {
  const edit = page.getByRole('checkbox', { name: 'Edit', exact: true });
  assert.equal(await edit.isEnabled(), true);
  const label = edit.locator('..');
  assert.ok((await label.boundingBox())!.height >= 44);
  const reader = page.locator('article.arc-markdown');
  const frame = await reader.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      border: parseFloat(style.borderBlockStartWidth),
      padding: parseFloat(style.paddingBlockStart),
    };
  });
  assert.ok(frame.border > 0 && frame.padding > 0);
  await label.tap();
  assert.equal(await edit.isChecked(), true);
  await page.getByRole('button', { name: 'Visual', exact: true }).waitFor();
  await label.tap();
  await reader.waitFor();
}

async function assertCompactRevisionMenu(page: Page) {
  await page.setViewportSize({ width: 320, height: 800 });
  const field = await page.getByLabel('File revision').boundingBox();
  const menu = await openSelect(page, 'File revision');
  const bounds = await menu.boundingBox();
  assert.ok(bounds && field && bounds.width >= field.width);
  assert.ok(
    await menu.getByRole('option').evaluateAll((options) =>
      options.every((option) => {
        const { left, right } = option.getBoundingClientRect();
        return left >= 0 && right <= innerWidth && getComputedStyle(option).whiteSpace === 'nowrap';
      }),
    ),
  );
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
  assert.equal(await selector.textContent(), 'Latest revision (aaaaaaaa)');
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
    await verifyDisplayDividers(page);
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

async function verifyDisplayDividers(page: Page) {
  const dividers = await page.locator('.arc-display').evaluateAll((panels) =>
    panels.map((panel) => {
      const heading = panel.querySelector(':scope > .arc-surface-heading')!;
      const body = panel.querySelector(':scope > .arc-display-body:not([hidden])')!;
      const style = getComputedStyle(heading);
      return {
        divider: style.borderBlockEndStyle === 'solid' && style.borderBlockEndWidth === '1px',
        themed: style.borderBlockEndColor === getComputedStyle(panel).borderBlockEndColor,
        inset:
          parseFloat(style.paddingBlockEnd) > 0 &&
          parseFloat(getComputedStyle(body).paddingBlockStart) > 0,
        spansPanel: Math.abs(heading.getBoundingClientRect().width - panel.clientWidth) < 1,
      };
    }),
  );
  assert.equal(dividers.length, 3);
  for (const display of dividers)
    assert.deepEqual(display, { divider: true, themed: true, inset: true, spansPanel: true });
}
