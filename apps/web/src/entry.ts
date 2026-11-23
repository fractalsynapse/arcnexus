import type { CommandBinding, CommandState } from '../../../packages/ui/src/index.js';
import { mountWeb } from './composition.js';

const unavailable: CommandState = { status: 'Unavailable', supported: [] };
const binding: CommandBinding = { getSnapshot: () => unavailable, subscribe: () => () => {} };

const root = document.getElementById('app');
if (!root) throw new Error('ArcNexus web root is missing');
await mountWeb(root, binding);
