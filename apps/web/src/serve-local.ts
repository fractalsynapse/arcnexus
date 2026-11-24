import { serveWeb } from './serve.js';

const { url } = await serveWeb('dist/apps/web/site', Number(process.argv[2] ?? 0));
console.log(url);
