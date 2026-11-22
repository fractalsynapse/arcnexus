import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { constants, gzipSync } from 'node:zlib';

const source = import.meta.dirname;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { viewer: { type: 'string' } },
});

const [capturePath] = positionals;

if (!capturePath || positionals.length !== 1 || values.viewer === '') {
  throw new Error('Usage: preview.ts <capture.json> [--viewer <output.html>]');
}

const capture = gzipSync(readFileSync(capturePath), { level: constants.Z_BEST_COMPRESSION }).toString(
  'base64',
);

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
    ...(values.viewer ? ['--minify'] : []),
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

const fragment = `${layout}
<script type="application/octet-stream" id="arc-capture">${capture}</script>
<script type="module">${script}</script>
`;

const preview = values.viewer
  ? resolve(values.viewer)
  : resolve(source, '../../../dist/docs/plans/mockup/index.html');

const html = values.viewer
  ? fragment
  : `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ArcNexus UI mockup</title>
</head>
<body>
${fragment}</body>
</html>
`;

const directory = dirname(preview);
mkdirSync(directory, { recursive: true });

// Replace the prior preview only after the complete new revision is available.
const scratch = mkdtempSync(join(directory, '.preview-'));
try {
  const revision = join(scratch, 'preview.html');
  writeFileSync(revision, html, { mode: 0o600 });
  renameSync(revision, preview);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(preview);
