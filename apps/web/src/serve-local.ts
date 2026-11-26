import { readSecret } from '../../../packages/foundation/src/secret-file.js';
import { serveWeb } from './serve.js';

const api = process.env.ARC_WEB_API_ORIGIN;
const credentialFile = process.env.ARC_WEB_OPERATOR_TOKEN_FILE;
const operator = credentialFile && {
  credential: readSecret(credentialFile),
  browserOrigin: process.env.ARC_WEB_BROWSER_ORIGIN,
};
const { url } = await serveWeb(
  'dist/apps/web/site',
  Number(process.argv[2] ?? 0),
  process.env.ARC_WEB_HOST,
  api ? new URL(api) : undefined,
  operator || undefined,
);
console.log(url);
