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
  await page.reload();
  await page.getByRole('heading', { name: 'Architect', level: 1 }).waitFor();
  await view(page, 'Release');
  assert.equal(
    await navigation.getByRole('link', { name: 'Release' }).getAttribute('aria-current'),
    'page',
  );
  assert.equal(await button(page, 'Refine').count(), 0);
  await assertUnavailableMetrics(page);
});

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
