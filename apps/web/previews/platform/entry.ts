import { mountWeb } from '../../src/composition.js';
import { platformUiPlugin } from '../../src/platform/index.js';
import { setPlatformTransport } from '../../src/platform/resource.js';
import { setSession } from '../../src/platform/session.js';
import { fixtureTransport, project } from './fixture-api.js';

const showProviders = new URLSearchParams(location.search).get('providers') === 'sample';
setPlatformTransport(fixtureTransport(showProviders));
setSession({ project });

const root = document.getElementById('app');
if (!root) throw new Error('Platform preview root is missing');
await mountWeb(root, undefined, platformUiPlugin);
