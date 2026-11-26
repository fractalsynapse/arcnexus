import { mountWeb } from '../../src/composition.js';
import { platformUiPlugin } from '../../src/platform/index.js';
import { fixtureTransport, project } from './fixture-api.js';

const showProviders = new URLSearchParams(location.search).get('providers') === 'sample';
const root = document.getElementById('app');
if (!root) throw new Error('Platform preview root is missing');
await mountWeb(root, {
  commands: 'hosted',
  feature: platformUiPlugin,
  platform: { transport: fixtureTransport(showProviders), project },
});
