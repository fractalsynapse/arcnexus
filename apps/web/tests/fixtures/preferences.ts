import type { Page } from 'playwright';
import { uiPreferencesResource } from '../../../../packages/ui/src/preferences/schema.js';
import { fixturePreferences } from '../../previews/platform/fixture-preferences.js';

/** Share an operator's preferences across clean browser contexts in acceptance tests. */
export async function preferenceRoutes(page: Page, store = fixturePreferences()) {
  await page.route('**/api/' + uiPreferencesResource, (route) => {
    const request = route.request();
    return route.fulfill({ json: store(request.method(), request.postData() ?? '') });
  });
}
