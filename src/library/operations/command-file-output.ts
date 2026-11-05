import { closeSync, fstatSync, ftruncateSync, openSync, readSync, writeSync } from 'node:fs';

export const commandOutputLimit = 64 * 1024 * 1024;

interface CapturedStream {
  writer: number;
  reader: number;
  offset: number;
}

/** Mirrors separate regular-file streams into diagnostics without using socket-backed child stdio. */
export class CommandFileOutput {
  private readonly streams: CapturedStream[];

  private overflow = false;

  private readonly buffer = Buffer.allocUnsafe(64 * 1024);

  /** Opens host-only readers for explicitly captured streams; their write descriptors remain caller-owned. */
  constructor(
    private readonly log: number,
    destinations: Array<{ path?: string; descriptor?: number }>,
  ) {
    this.streams = [];
    try {
      for (const destination of destinations) {
        if (destination.path === undefined || destination.descriptor === undefined) continue;
        this.streams.push({
          writer: destination.descriptor,
          reader: openSync(destination.path, 'r'),
          offset: 0,
        });
      }
    } catch (error) {
      for (const stream of this.streams) closeSync(stream.reader);
      throw error;
    }
  }

  /** Copies newly observed bytes and reports the shared output bound without counting mirrored bytes twice. */
  poll(): boolean {
    const pending = this.streams.reduce(
      (size, stream) => size + Math.max(0, fstatSync(stream.reader).size - stream.offset),
      0,
    );
    this.overflow ||= fstatSync(this.log).size + pending > commandOutputLimit;
    for (const stream of this.streams) this.copy(stream);
    return this.overflow;
  }

  /** Flushes final bytes, bounds interrupted/oversized evidence and releases all host-only read handles. */
  close(): boolean {
    try {
      this.poll();
      if (fstatSync(this.log).size > commandOutputLimit)
        ftruncateSync(this.log, commandOutputLimit);
      for (const stream of this.streams)
        if (this.overflow && fstatSync(stream.writer).size > stream.offset)
          ftruncateSync(stream.writer, stream.offset);
      return this.overflow;
    } finally {
      for (const stream of this.streams) closeSync(stream.reader);
    }
  }

  /** Reads each separate stream by offset so its complete bytes remain distinct from diagnostic warnings. */
  private copy(stream: CapturedStream): void {
    let remaining = commandOutputLimit - fstatSync(this.log).size;
    while (remaining > 0) {
      const count = readSync(
        stream.reader,
        this.buffer,
        0,
        Math.min(this.buffer.length, remaining),
        stream.offset,
      );
      if (!count) return;
      writeSync(this.log, this.buffer.subarray(0, count));
      stream.offset += count;
      remaining -= count;
    }
  }
}
