import { bundleWeb } from '../../src/bundle.js';
import { serveWeb } from '../../src/serve.js';

const directory = 'dist/apps/web/platform-preview';
await bundleWeb('apps/web/previews/platform/entry.ts', directory);
const { url } = await serveWeb(directory, Number(process.argv[2] ?? 0));
console.log(url);
