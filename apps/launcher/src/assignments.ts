import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { readServerEvents } from '../../../packages/foundation/src/index.js';
import { hostAssignmentSchema } from './host-assignment.js';
import { startHost } from './host-runtime.js';

const notice = hostAssignmentSchema.pick({ project: true, revision: true });
const identity = ({ project, revision }: z.output<typeof notice>) => project + '/' + revision;

/** Match only a project identity and revision approved on this machine. */
export async function serveAssignments(
  body: ReadableStream<Uint8Array<ArrayBuffer>>,
  file?: string,
) {
  const configured = file
    ? z.array(hostAssignmentSchema).parse(JSON.parse(readFileSync(file, 'utf8')) as unknown)
    : [];
  const assigned = new Map(configured.map((config) => [identity(config), config]));
  if (assigned.size !== configured.length) throw new Error('Duplicate local Host assignment');
  await readServerEvents(body, async (frame) => {
    if (!/^event: assignment$/m.test(frame)) return;
    const content = /^data: (.+)$/m.exec(frame)?.[1];
    if (!content) throw new Error('Platform returned an invalid assignment notice');
    const target = notice.parse(JSON.parse(content) as unknown);
    const config = assigned.get(identity(target));
    if (!config) {
      console.error('No locally approved Host for ' + identity(target));
      return;
    }
    const launched = await startHost(config);
    console.log(JSON.stringify({ ...target, ...launched }));
  });
}
