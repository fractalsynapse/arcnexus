import type { Page } from 'playwright';

export async function openSelect(page: Page, label: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  const menu = page.getByRole('listbox');
  await menu.waitFor();
  return menu;
}

export async function chooseOption(page: Page, label: string, option: string | RegExp) {
  const menu = await openSelect(page, label);
  await menu.getByRole('option', { name: option, exact: true }).click();
}
