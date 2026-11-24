import { mountWeb } from './composition.js';
import { platformUiPlugin } from './platform/index.js';

const root = document.getElementById('app');
if (!root) throw new Error('ArcNexus web root is missing');
await mountWeb(root, undefined, platformUiPlugin);
