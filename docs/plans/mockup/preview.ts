import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { constants, gzipSync } from 'node:zlib';
import { encodeBase85 } from './base85.ts';
import type { Capture } from './model.ts';

const source = import.meta.dirname;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { viewer: { type: 'string' }, file: { type: 'string' } },
});

const [capturePath] = positionals;

if (!capturePath || positionals.length !== 1 || values.viewer === '' || values.file === '') {
  throw new Error(
    'Usage: preview.ts <capture.json> [--viewer <output.html>] [--file <captured-path>]',
  );
}

const capture = gzipSync(previewCapture(readFileSync(capturePath), values.file), {
  level: constants.Z_BEST_COMPRESSION,
});

const script = bundle('main.ts', Boolean(values.viewer));

const sortable = readFileSync(
  resolve(source, '../../../packages/ui/src/controls/sortable.css'),
  'utf8',
);
const layout = readFileSync(resolve(source, 'layout.html'), 'utf8')
  .replace('/* shared-sortable-styles */', sortable)
  .replace(
    /(["'])brand\/([a-z-]+\.webp)\1/g,
    (_, quote: string, filename: string) => {
      const image = readFileSync(resolve(source, 'brand', filename)).toString('base64');
      return quote + 'data:image/webp;base64,' + image + quote;
    },
  );

const encodedCapture = values.viewer ? encodeBase85(capture) : capture.toString('base64');
const fragment = `${layout}
<script type="application/octet-stream" id="arc-capture"${values.viewer ? ' data-encoding="base85"' : ''}>${encodedCapture}</script>
${values.viewer ? viewerScript(script) : `<script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script>`}
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

function previewCapture(raw: Buffer, path: string | undefined) {
  if (!path) return raw;
  const data = JSON.parse(raw.toString('utf8')) as Capture;
  const file = data.files.find((item) => item.path === path);
  if (!file) throw new Error('File is missing from the capture: ' + path);
  const review: Capture = {
    ...data,
    fileReview: true,
    files: [file],
    goals: [],
    directories: [],
    tools: {},
    payloads: [],
    plan: { ...data.plan, rows: [] },
    architect: { ...data.architect, rows: [] },
  };
  return Buffer.from(JSON.stringify(review));
}

function viewerScript(code: string) {
  const packed = gzipSync(code, { level: constants.Z_BEST_COMPRESSION }).toString('base64');
  return `<script type="application/octet-stream" id="arc-bundle">${packed}</script>
<script type="module">${bundle('viewer-entry.ts', true)}</script>`;
}

function bundle(entry: string, minify: boolean) {
  const scratch = mkdtempSync(join(tmpdir(), 'arc-mockup-'));
  const output = join(scratch, 'bundle.js');
  try {
    execFileSync(
      'npm',
      [
        'exec',
        '--yes',
        '--package=esbuild@0.28.2',
        '--',
        'esbuild',
        resolve(source, entry),
        '--bundle',
        '--format=esm',
        '--outfile=' + output,
        '--loader:.css=text',
        '--define:process.env.NODE_ENV="production"',
        ...(minify ? ['--minify'] : []),
        '--log-level=warning',
      ],
      { stdio: 'inherit' },
    );
    return readFileSync(output, 'utf8');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
