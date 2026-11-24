import { serveWeb } from './serve.js';

const api = process.env.ARC_WEB_API_ORIGIN;
const { url } = await serveWeb(
  'dist/apps/web/site',
  Number(process.argv[2] ?? 0),
  process.env.ARC_WEB_HOST,
  api ? new URL(api) : undefined,
);
console.log(url);
