/** Read complete event frames from ArcNexus streams, including UTF-8 split across chunks. */
export async function readServerEvents(
  body: ReadableStream<Uint8Array<ArrayBuffer>>,
  receive: (frame: string) => void | Promise<void>,
) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      pending += chunk.value;
      let boundary = pending.indexOf('\n\n');
      while (boundary !== -1) {
        await receive(pending.slice(0, boundary));
        pending = pending.slice(boundary + 2);
        boundary = pending.indexOf('\n\n');
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
