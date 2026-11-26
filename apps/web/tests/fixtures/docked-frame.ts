import assert from 'node:assert/strict';
import type { Locator, Page } from 'playwright';

export async function assertDocked(page: Page) {
  await page.getByRole('region', { name: 'Planning data' }).waitFor();
  const dockInset = await expanderInset(
    page.getByRole('button', { name: 'Collapse command panel' }),
  );
  assert.ok(dockInset > 0);
  assert.equal(
    await expanderInset(page.getByRole('button', { name: 'Expand Planning data' })),
    dockInset,
  );
  await page.evaluate(() => window.scrollTo(0, innerHeight));
  const nav = await page.getByRole('navigation', { name: 'Workspace' }).boundingBox();
  const header = await page.getByRole('banner').boundingBox();
  const footer = await page.getByRole('contentinfo', { name: 'Command controls' }).boundingBox();
  assert.ok(nav && nav.y === 0, 'the links are pinned');
  assert.ok(header && header.y + header.height < 0, 'the brand scrolls away');
  assert.ok(
    footer && footer.y + footer.height === page.viewportSize()?.height,
    'the command dock stays in view',
  );
}

function expanderInset(control: Locator) {
  return control.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).marginInlineEnd),
  );
}
