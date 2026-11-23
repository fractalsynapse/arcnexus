import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';

/** Assemble the browser assets from a web application entry. */
export async function bundleWeb(entry: string, output: string) {
  await mkdir(output, { recursive: true });
  await build({
    entryPoints: { app: entry },
    outdir: output,
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.webp': 'file' },
    assetNames: 'assets/[name]-[hash]',
    logLevel: 'warning',
  });
  await copyFile(resolve('apps/web/index.html'), resolve(output, 'index.html'));
}
