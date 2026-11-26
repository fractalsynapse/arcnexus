import { readSync, writeSync } from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import type { JournalRow } from '../journal-store.js';

export type SessionRequest =
  | {
      kind: 'open';
      connectionString: string;
      project: string;
      worker: string;
    }
  | { kind: 'query'; sql: string; values: Array<string | number | null> }
  | { kind: 'close' };

export type SessionResult = { rows: JournalRow[]; changes: number };
export type SessionReply = { ok: true; result: SessionResult } | { ok: false; error: string };

export function sendFrame(fd: number, value: SessionRequest | SessionReply) {
  const bytes = Buffer.from(JSON.stringify(value) + '\n');
  let offset = 0;
  while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset);
}

/** Read one complete reply from the private pipe, or observe peer loss as EOF. */
export function readReply(fd: number): SessionReply {
  const bytes = Buffer.allocUnsafe(64 * 1024);
  const decoder = new StringDecoder('utf8');
  let text = '';
  for (;;) {
    const received = readSync(fd, bytes, 0, bytes.length, null);
    if (!received) throw new Error('PostgreSQL writer session disconnected');
    text += decoder.write(bytes.subarray(0, received));
    if (text.endsWith('\n')) return JSON.parse(text) as SessionReply;
  }
}
