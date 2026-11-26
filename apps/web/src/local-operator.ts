import type { IncomingMessage } from 'node:http';

export interface LocalOperator {
  credential: string;
  /** External loopback origin when an isolated container publishes the web port. */
  browserOrigin?: string;
}

const loopbackNames = ['127.0.0.1', '[::1]', 'localhost'];

/** Validate the loopback deployment and resolve its configured browser authority. */
export function browserAuthority(host: string, operator: LocalOperator) {
  if (operator.browserOrigin) {
    const origin = new URL(operator.browserOrigin);
    if (
      origin.protocol !== 'http:' ||
      origin.origin !== operator.browserOrigin ||
      !loopbackNames.includes(origin.hostname)
    )
      throw new Error('The local operator requires a loopback browser origin');
    return origin.host;
  }
  if (host !== '::1' && !loopbackNames.includes(host))
    throw new Error('Configure the published loopback origin for this local operator');
}

/** Keep the deployment credential out of cross-origin and DNS-rebinding requests. */
export function allowsLocalRequest(request: IncomingMessage, port: number, authority?: string) {
  const { host, origin, 'sec-fetch-site': site } = request.headers;
  const expected = authority ? [authority] : loopbackNames.map((name) => name + ':' + port);
  return (
    !!host &&
    expected.includes(host) &&
    (!origin || origin === 'http://' + host) &&
    (!site || site === 'same-origin' || site === 'none')
  );
}
