/** Keep operator and launcher credentials on HTTPS or an explicitly local loopback. */
export function platformEndpoint(input: string) {
  const url = new URL(input);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Use HTTPS or a local loopback endpoint');
  return url.href.replace(/\/$/, '');
}
