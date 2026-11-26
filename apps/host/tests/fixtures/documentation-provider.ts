#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const setting = process.argv.find((entry) => entry.startsWith('mcp_servers='));
assert.ok(setting);
const url = JSON.parse(setting.split('url=')[1]!.split(',required=')[0]!) as string;
const path = 'handbook/operations/recovery.adoc';

async function call(method: string, params?: object) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
  });
  assert.ok(response.ok);
  return (await response.json()) as {
    result?: {
      tools?: { name: string }[];
      structuredContent?: { text: string };
      isError?: boolean;
    };
    error?: unknown;
  };
}

const input = readFileSync(0, 'utf8');
assert.match(input, /recommend objectives/);
assert.doesNotMatch(input, /UNTRUSTED_TARGET_CONFIGURATION/);
assert.ok(!existsSync('handbook'));
assert.ok(!existsSync('AGENTS.md'));
const tools = await call('tools/list');
assert.deepEqual(tools.result?.tools?.map(({ name }) => name).sort(), ['list-files', 'read-file']);
const read = await call('tools/call', { name: 'read-file', arguments: { path } });
const quote = read.result?.structuredContent?.text;
assert.ok(quote && !read.result?.isError);
const refused = await call('tools/call', { name: 'read-file', arguments: { path: '/etc/passwd' } });
assert.ok(refused.error || refused.result?.isError);
const drafts = ['measure-recovery', 'rehearse-recovery'].map((id) => ({
  id,
  category: 'reliability',
  title: id,
  content: '# Recovery\n',
  gap: 'The handbook calls for a recovery rehearsal.',
  sources: [{ path, quote: quote.trim() }],
}));
console.log(
  JSON.stringify({
    type: 'item.completed',
    item: {
      type: 'agent_message',
      text: JSON.stringify({ summary: 'Recovery guidance assessed.', drafts }),
    },
  }),
);
