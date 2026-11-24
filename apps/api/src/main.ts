import { verifyPlatformDatabase } from '../../db/src/index.js';
import { capacityPlugin } from '../../../packages/capacity/src/index.js';
import { reviewPlatform } from '../../../packages/platform/src/index.js';
import { launcherBuilds } from './launcher-builds.js';
import { apiPlugin, capacityApiPlugin, serveApi } from './index.js';

const { context, database, authenticate, followTimeline, followCommands, hostAssignments } =
  await reviewPlatform();
await verifyPlatformDatabase(database);
await context.use(apiPlugin(authenticate, followTimeline, followCommands));
await context.use(capacityPlugin(database));
await context.use(
  capacityApiPlugin(
    async (request) => (await authenticate(request, 'platform'))?.principal,
    hostAssignments,
  ),
);
const builds = launcherBuilds(process.env.ARC_LAUNCHER_ARTIFACTS);
const { url } = await serveApi(
  async (request) => {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET')
      return new Response(null, { status: 204, headers: { 'X-ArcNexus-Service': 'api' } });
    if (path === '/launcher-builds' || path.startsWith('/launcher-builds/')) return builds(request);
    if (path.startsWith('/capacity-providers')) return context.capacityApi(request);
    return context.api(request);
  },
  Number(process.env.PORT ?? 0),
  process.env.ARC_GATEWAY_BIND,
);
console.log(url);
