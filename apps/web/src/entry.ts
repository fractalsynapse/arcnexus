import { mountWeb } from './composition.js';

const root = document.getElementById('app');
if (!root) throw new Error('ArcNexus web root is missing');
await mountWeb(root);
