import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/** Expose an assembled API on loopback for isolated gateway verification. */
export async function serveApi(
  handle: (request: Request) => Promise<Response>,
  port = 0,
  host = '127.0.0.1',
) {
  const server = createServer((request, response) => {
    void forward(handle, request, response).catch(() => response.destroy());
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('API has no TCP listener');
  return { server, url: 'http://127.0.0.1:' + address.port };
}

async function forward(
  handle: (request: Request) => Promise<Response>,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  const options: RequestInit & { duplex: 'half' } = {
    method: incoming.method,
    headers,
    duplex: 'half',
    body:
      incoming.method === 'GET' || incoming.method === 'HEAD'
        ? undefined
        : (Readable.toWeb(incoming) as unknown as ReadableStream<Uint8Array>),
  };
  const controller = new AbortController();
  outgoing.once('close', () => controller.abort());
  const request = new Request(new URL(incoming.url ?? '/', 'http://127.0.0.1'), {
    ...options,
    signal: controller.signal,
  });
  const response = await handle(request);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) await pipeline(response.body, outgoing);
  else outgoing.end();
}
