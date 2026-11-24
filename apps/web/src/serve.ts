import { proxyApi } from './api-proxy.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const types = { js: 'text/javascript', css: 'text/css', webp: 'image/webp', html: 'text/html' };

/** Serve the compiled browser entry and its public assets on the requested interface. */
export async function serveWeb(directory: string, port = 0, host = '127.0.0.1', api?: URL) {
  const server = createServer((request, response) => {
    if (api && request.url?.startsWith('/api/')) {
      proxyApi(api, request, response);
      return;
    }
    void serveAsset(directory, request, response);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Web server has no TCP address');
  const hostname =
    address.family === 'IPv6'
      ? `[${address.address === '::' ? '::1' : address.address}]`
      : address.address === '0.0.0.0'
        ? '127.0.0.1'
        : address.address;
  return { server, url: `http://${hostname}:${address.port}` };
}

/** Give workspace addresses the same shell while serving generated assets by exact path. */
async function serveAsset(directory: string, request: IncomingMessage, response: ServerResponse) {
  const path = request.url?.split('?')[0] ?? '';
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  const asset = /^\/(?:app\.(js|css)|assets\/[\w-]+\.webp)$/.test(path);
  const relative = asset ? path.slice(1) : 'index.html';
  const extension = relative.split('.').at(-1) as keyof typeof types;
  try {
    const contents = await readFile(join(directory, relative));
    response.writeHead(200, { 'Content-Type': types[extension], 'Cache-Control': 'no-cache' });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
    response
      .writeHead(missing ? 404 : 500)
      .end(missing ? 'File not found' : 'Unable to read web assets');
  }
}
