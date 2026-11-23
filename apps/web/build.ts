import { bundleWeb } from './src/bundle.js';

await bundleWeb('apps/web/src/entry.ts', 'dist/apps/web/site');
