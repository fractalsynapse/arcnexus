import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { build } from 'esbuild';

/** Assemble the browser assets from a web application entry. */
export async function bundleWeb(entry: string, output: string) {
  await mkdir(output, { recursive: true });
  const { metafile } = await build({
    entryPoints: { app: entry },
    outdir: output,
    bundle: true,
    minify: true,
    platform: 'browser',
    format: 'esm',
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.webp': 'file' },
    assetNames: 'assets/[name]-[hash]',
    publicPath: '/',
    metafile: true,
    logLevel: 'warning',
  });
  const logo = resolve('packages/ui/assets/brain.webp');
  const favicon = Object.entries(metafile.outputs).find(
    ([file, asset]) =>
      file.endsWith('.webp') && Object.keys(asset.inputs).some((input) => resolve(input) === logo),
  );
  if (!favicon) throw new Error('The browser bundle is missing the ArcNexus logo');
  const shell = await readFile('apps/web/index.html', 'utf8');
  const iconUrl = '/' + relative(output, favicon[0]).replaceAll(sep, '/');
  await writeFile(resolve(output, 'index.html'), shell.replace('__FAVICON__', iconUrl));
}
