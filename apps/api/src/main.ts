import { verifyPlatformDatabase } from '../../db/src/index.js';
import { capacityPlugin } from '../../../packages/capacity/src/index.js';
import { reviewPlatform } from '../../../packages/platform/src/index.js';
import { apiPlugin, capacityApiPlugin, serveApi } from './index.js';

const { context, database, authenticate } = await reviewPlatform();
await verifyPlatformDatabase(database);
await context.use(apiPlugin(authenticate));
await context.use(capacityPlugin(database));
await context.use(
  capacityApiPlugin(async (request) => (await authenticate(request, 'platform'))?.principal),
);
const { url } = await serveApi(
  (request) =>
    new URL(request.url).pathname.startsWith('/capacity-providers')
      ? context.capacityApi(request)
      : context.api(request),
  Number(process.env.PORT ?? 0),
  process.env.ARC_GATEWAY_BIND,
);
console.log(url);
