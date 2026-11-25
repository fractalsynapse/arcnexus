import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import { bundleWeb } from '../../src/bundle.js';
import { serveWeb } from '../../src/serve.js';
import type {} from '../fixtures/browser.js';

export const suite = { owner: 'web-app', level: 'acceptance', tags: ['browser'] } as const;

let browser: Browser;
let application: Awaited<ReturnType<typeof serveWeb>>;
let fixture: Awaited<ReturnType<typeof serveWeb>>;
let fixturePath: string;

before(async () => {
  application = await serveWeb('dist/apps/web/site');
  fixturePath = await mkdtemp(join(tmpdir(), 'arcnexus-web-acceptance-'));
  await bundleWeb('apps/web/tests/fixtures/browser.ts', fixturePath);
  fixture = await serveWeb(fixturePath);
  browser = await chromium.launch({ executablePath: process.env.ARC_CHROMIUM_PATH });
});

after(async () => {
  await browser?.close();
  application?.server.close();
  fixture?.server.close();
  if (fixturePath) await rm(fixturePath, { recursive: true });
});

function button(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

async function view(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Workspace' })
    .getByRole('link', { name, exact: true })
    .click();
  const heading = page.getByRole('heading', { name, level: 1 });
  await heading.waitFor();
  return heading;
}

test('web server defaults to loopback and can listen on the container interface', async (t) => {
  const local = application.server.address();
  assert.ok(local && typeof local === 'object');
  assert.equal(local.address, '127.0.0.1');

  const container = await serveWeb('dist/apps/web/site', 0, '0.0.0.0');
  t.after(() => container.server.close());
  const binding = container.server.address();
  assert.ok(binding && typeof binding === 'object');
  assert.equal(binding.address, '0.0.0.0');
  assert.equal((await fetch(container.url + '/plan/')).status, 200);
});

test('built shell exposes all workspaces and reports unavailable live commands', async (t) => {
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.goto(application.url);
  await page.getByRole('heading', { name: 'Plan', level: 1 }).waitFor();
  const navigation = page.getByRole('navigation', { name: 'Workspace' });
  assert.deepEqual(await navigation.getByRole('link').allTextContents(), [
    'Plan',
    'Architect',
    'Run',
    'Release',
  ]);
  assert.equal(await page.getByRole('banner').count(), 1);
  assert.equal(await button(page, 'Refine').isDisabled(), true);
  assert.equal(await button(page, 'Send').isDisabled(), true);
  assert.equal((await page.request.post(application.url)).status(), 405);
  assert.equal(
    await (await view(page, 'Architect')).evaluate((element) => document.activeElement === element),
    true,
  );
  await assertReloadedWorkspace(page, 'Architect');
  await view(page, 'Release');
  assert.equal(
    await navigation.getByRole('link', { name: 'Release' }).getAttribute('aria-current'),
    'page',
  );
  assert.equal(await button(page, 'Refine').isDisabled(), true);
  await assertUnavailableMetrics(page);
});

async function assertReloadedWorkspace(page: Page, name: string) {
  await page.reload();
  await page.getByRole('heading', { name, level: 1 }).waitFor();
  const images = await page.getByRole('link', { name: 'ArcNexus home' }).locator('img').all();
  assert.equal(images.length, 2);
  for (const image of images) {
    assert.equal(
      await image.evaluate(async (element: HTMLImageElement) => {
        await element.decode();
        return element.naturalWidth > 0;
      }),
      true,
    );
  }
}

async function assertUnavailableMetrics(page: Page) {
  await button(page, 'Round metrics').click();
  const metrics = page.getByRole('dialog', { name: 'End-to-end refinement metrics' });
  await metrics.getByText('Round measurements').waitFor();
  assert.equal(await metrics.getByText('Unavailable', { exact: true }).count(), 3);
}

test('site schemes can be created, selected and reloaded across workspaces', async (t) => {
  const page = await browser.newPage({ colorScheme: 'dark' });
  t.after(() => page.close());
  await page.goto(application.url);
  await makeSiteScheme(page);
  await button(page, 'Close').click();
  assert.equal(
    await button(page, 'Color schemes').evaluate((element) => document.activeElement === element),
    true,
  );
  await view(page, 'Run');
  await page.reload();
  await page.getByRole('heading', { name: 'Run', level: 1 }).waitFor();
  assert.equal(
    await page.locator('.arc-app').evaluate((element) => getComputedStyle(element).backgroundColor),
    'rgb(20, 19, 42)',
  );
});

async function makeSiteScheme(page: Page) {
  await button(page, 'Color schemes').click();
  const dialog = page.getByRole('dialog', { name: 'Color schemes' });
  await dialog.getByLabel('Scheme name').fill('Midnight');
  await button(page, 'Background color').click();
  const picker = page.getByRole('dialog', { name: 'Background color' });
  await picker.getByRole('button', { name: 'Indigo #14132a for background' }).click();
  assert.equal(await picker.isVisible(), false);
  await button(page, 'Save scheme').click();
  await dialog.getByLabel('Site background and default scheme').selectOption({ label: 'Midnight' });
  await dialog.getByLabel('Scheme name').fill('Midnight revised');
  await button(page, 'Text color').click();
  const custom = page.getByRole('dialog', { name: 'Text color' }).getByLabel('Custom hex color');
  await custom.fill('#edf4ff');
  await custom.press('Enter');
  await button(page, 'Save scheme').click();
  assert.equal(
    await dialog.locator('select').first().locator('option:checked').textContent(),
    'Midnight revised',
  );
}

test('desktop stays docked and reports controlled active, waiting and failed command states', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1180, height: 800 } });
  t.after(() => page.close());
  await page.goto(fixture.url);
  assert.equal(await button(page, 'Collapse command panel').isVisible(), true);
  await assertDocked(page);
  await view(page, 'Architect');
  assert.equal(await page.evaluate(() => scrollY), 0);
  await submitFixtureCommand(page);
  await button(page, 'Round metrics').click();
  await page
    .getByRole('dialog', { name: 'End-to-end refinement metrics' })
    .getByText('2m 31s')
    .waitFor();
});

async function assertDocked(page: Page) {
  await page.evaluate(() => window.scrollTo(0, innerHeight));
  const nav = await page.getByRole('navigation', { name: 'Workspace' }).boundingBox();
  const header = await page.getByRole('banner').boundingBox();
  const footer = await page.getByRole('contentinfo', { name: 'Command controls' }).boundingBox();
  assert.ok(nav && nav.y === 0, 'the links are pinned');
  assert.ok(header && header.y + header.height < 0, 'the brand scrolls away');
  assert.ok(footer && footer.y + footer.height === 800, 'the command dock stays in view');
}

async function submitFixtureCommand(page: Page) {
  const instruction = page.getByRole('textbox', { name: 'Instruction optional' });
  await instruction.fill('Keep this draft if the command fails.');
  await page.getByLabel('Operation', { exact: true }).selectOption('architect');
  await button(page, 'Send').click();
  const readout = page.getByRole('group', { name: 'Round state' });
  await readout.getByText('Active', { exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.frameFixture.requests), [
    {
      operation: 'architect',
      workspace: '/architect/',
      instruction: 'Keep this draft if the command fails.',
    },
  ]);
  await page.evaluate(() => window.frameFixture.wait());
  await readout.getByText('Waiting', { exact: true }).waitFor();
  await page.evaluate(() => window.frameFixture.fail());
  await readout.getByText('Failed', { exact: true }).waitFor();
  assert.match(await page.getByRole('alert').innerText(), /controlled command failed/);
  assert.equal(await instruction.inputValue(), 'Keep this draft if the command fails.');
}

test('mobile starts compact and puts the operation row above the optional instruction', async (t) => {
  const page = await browser.newPage({
    viewport: { width: 320, height: 660 },
    isMobile: true,
    hasTouch: true,
  });
  t.after(() => page.close());
  await page.goto(application.url);
  await button(page, 'Expand command panel').click();
  const select = await page.getByLabel('Operation', { exact: true }).boundingBox();
  const instruction = await page
    .getByRole('textbox', { name: 'Instruction optional' })
    .boundingBox();
  const send = await button(page, 'Send').boundingBox();
  assert.ok(select && instruction && select.y < instruction.y);
  assert.ok(select && send && select.y + select.height === send.y + send.height);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await button(page, 'Collapse command panel').click();
  assert.equal(await page.getByLabel('Operation', { exact: true }).isVisible(), false);
});

test('header tooltips clear the narrow navigation and menu options share the field theme', async (t) => {
  const page = await browser.newPage({
    viewport: { width: 360, height: 660 },
    colorScheme: 'dark',
  });
  t.after(() => page.close());
  await page.goto(application.url + '/release/');
  await button(page, 'Color schemes').hover();
  const tooltip = page.locator('.arc-tooltip:popover-open').filter({ hasText: /^Color schemes$/ });
  await tooltip.waitFor();
  assert.equal(
    await tooltip.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hints = element as HTMLElement;
      hints.style.pointerEvents = 'auto';
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 2);
      hints.style.removeProperty('pointer-events');
      return hit === element;
    }),
    true,
  );
  await button(page, 'Color schemes').click();
  await assertStyledMenu(page, 'Site background and default scheme');
  await button(page, 'Close').click();
  await button(page, 'Expand command panel').click();
  await assertStyledMenu(page, 'Operation');
});

async function assertStyledMenu(page: Page, label: string) {
  const select = page.getByLabel(label, { exact: true });
  await select.click();
  await page.locator('select:open').waitFor();
  assert.equal(
    await select.evaluate((element) => {
      const trigger = getComputedStyle(element);
      const menu = getComputedStyle(element, '::picker(select)');
      return (
        menu.appearance === 'base-select' &&
        menu.backgroundColor === trigger.backgroundColor &&
        menu.borderColor === trigger.borderColor
      );
    }),
    true,
  );
  await page.keyboard.press('Escape');
}

test('page settings save layout and panel placement, while plugin contributions update mounted pages', async (t) => {
  const page = await browser.newPage({ viewport: { width: 1180, height: 800 } });
  t.after(() => page.close());
  await page.goto(fixture.url);
  await page.getByRole('heading', { name: 'Planning data' }).waitFor();
  await page.evaluate(() => window.frameFixture.toggleDisplay?.());
  const evidence = page.getByRole('heading', { name: 'Supporting evidence' });
  await evidence.waitFor();
  await page.evaluate(() => window.frameFixture.toggleDisplay?.());
  await evidence.waitFor({ state: 'detached' });

  await configureLayout(page);
  await assertResize(page);
  await page.reload();
  await page.getByRole('separator', { name: 'Resize columns 2 and 3' }).waitFor();
  assert.equal(
    await page
      .locator('.arc-layout-column')
      .nth(2)
      .getByRole('heading', { name: 'Planner outcome' })
      .count(),
    1,
  );
  await assertMobilePanelOrder(page);
});

async function assertMobilePanelOrder(page: Page) {
  await page.setViewportSize({ width: 360, height: 800 });
  assert.equal(await page.getByRole('separator').count(), 0);
  assert.deepEqual(
    await page.locator('.arc-display').evaluateAll((panels) =>
      panels
        .map((panel) => [panel.querySelector('h2')?.textContent, panel.getBoundingClientRect().top])
        .sort((left, right) => Number(left[1]) - Number(right[1]))
        .map(([label]) => label),
    ),
    ['Planner outcome', 'Planning data'],
  );
}

async function configureLayout(page: Page) {
  const settings = button(page, 'Plan page settings');
  await settings.click();
  assert.equal(await page.getByRole('heading', { name: 'Planning data' }).count(), 0);
  await page.getByRole('radio', { name: 'Three columns' }).check();
  await button(page, 'Remove Planner outcome').click();
  await button(page, 'Available panels').click();
  await button(page, 'Add Planner outcome').click();
  await button(page, 'Active panels').click();
  await assertStyledMenu(page, 'Planner outcome region');
  await page.getByLabel('Planner outcome region').selectOption({ label: 'Right' });
  await button(page, 'Reorder Planner outcome').press('ArrowUp');
  await button(page, 'Save').click();
  assert.equal(await settings.evaluate((element) => document.activeElement === element), true);
  await settings.click();
  await page.getByRole('radio', { name: 'One column' }).check();
  await button(page, 'Close').click();
  assert.equal(await page.locator('.arc-layout-column').count(), 3);
}

async function assertResize(page: Page) {
  const splitter = page.getByRole('separator', { name: 'Resize columns 1 and 2' });
  const opacity = () =>
    splitter.evaluate((element) => getComputedStyle(element, '::before').opacity);
  assert.equal(await opacity(), '0');
  const bounds = await splitter.boundingBox();
  assert.ok(bounds);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 40);
  assert.equal(await opacity(), '1');
  const before = await splitter.getAttribute('aria-valuenow');
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 42, bounds.y + 40);
  await page.mouse.up();
  const afterDrag = await splitter.getAttribute('aria-valuenow');
  assert.notEqual(afterDrag, before);
  await splitter.press('ArrowRight');
  assert.notEqual(await splitter.getAttribute('aria-valuenow'), afterDrag);
}
