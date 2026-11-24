const packed = document.getElementById('arc-bundle')?.textContent;
if (!packed) throw new Error('The embedded mockup bundle is missing.');

const bytes = Uint8Array.from(atob(packed), (byte) => byte.charCodeAt(0));
const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
const module = new Blob([await new Response(stream).arrayBuffer()], { type: 'text/javascript' });
const url = URL.createObjectURL(module);
try {
  await import(url);
} finally {
  URL.revokeObjectURL(url);
}

export {};
