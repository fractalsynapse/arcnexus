import { request as http, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as https } from 'node:https';

/** Forward only same-origin API requests to the configured internal adapter. */
export function proxyApi(
  origin: URL,
  incoming: IncomingMessage,
  outgoing: ServerResponse,
  credential?: string,
) {
  const destination = new URL(origin);
  const path = incoming.url!.slice('/api'.length);
  const index = path.indexOf('?');
  destination.pathname = index < 0 ? path : path.slice(0, index);
  destination.search = index < 0 ? '' : path.slice(index);
  const send = destination.protocol === 'https:' ? https : http;
  const headers = { ...incoming.headers, host: destination.host };
  if (credential) headers.authorization = 'Bearer ' + credential;
  const request = send(destination, { method: incoming.method, headers }, (response) => {
    const returned = credential
      ? { ...response.headers, 'cache-control': 'no-store' }
      : response.headers;
    outgoing.writeHead(response.statusCode ?? 502, returned);
    response.pipe(outgoing);
  });
  request.on('error', () => {
    if (outgoing.headersSent) outgoing.destroy();
    else outgoing.writeHead(502).end();
  });
  outgoing.once('close', () => request.destroy());
  incoming.pipe(request);
}
