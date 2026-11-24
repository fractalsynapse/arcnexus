import { verifyPlatformDatabase } from '../../db/src/index.js';
import { reviewPlatform } from '../../../packages/platform/src/index.js';
import { serveApi } from '../../api/src/index.js';
import { operatorMcpHttp, operatorMcpPlugin } from './index.js';

const { context, database, authenticate } = await reviewPlatform();
await verifyPlatformDatabase(database);
await context.use(operatorMcpPlugin);
const { url } = await serveApi(
  operatorMcpHttp(context.operatorMcp, authenticate),
  Number(process.env.PORT ?? 0),
  process.env.ARC_GATEWAY_BIND,
);
console.log(url);
