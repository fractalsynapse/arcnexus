import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const source = import.meta.dirname;

const capturePath = process.argv[2];

if (!capturePath) {
  throw new Error('Pass the path to a local mockup capture JSON.');
}

const capture = gzipSync(readFileSync(capturePath)).toString('base64');

const script = execFileSync(
  'npm',
  [
    'exec',
    '--yes',
    '--package=esbuild@0.28.2',
    '--',
    'esbuild',
    resolve(source, 'main.ts'),
    '--bundle',
    '--format=esm',
    '--log-level=warning',
  ],
  { encoding: 'utf8' },
).replace(/<\/script/gi, '<\\/script');

const layout = readFileSync(resolve(source, 'layout.html'), 'utf8').replace(
  /(["'])brand\/([a-z-]+\.webp)\1/g,
  (_, quote: string, filename: string) => {
    const image = readFileSync(resolve(source, 'brand', filename)).toString('base64');
    return quote + 'data:image/webp;base64,' + image + quote;
  },
);

const output = resolve(source, '../../../dist/docs/plans/mockup');

mkdirSync(output, { recursive: true });

const preview = resolve(output, 'index.html');

writeFileSync(
  preview,
  `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ArcNexus UI mockup</title>
</head>
<body>
${layout}
<script type="application/octet-stream" id="arc-capture">${capture}</script>
<script type="module">${script}</script>
</body>
</html>
`,
  { mode: 0o600 },
);

console.log(preview);
