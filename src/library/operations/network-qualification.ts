import { createServer } from 'node:http';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { SourceConfinement } from './confinement.js';
import { execute } from './process.js';

/** Qualifies proxy-only read access on a disposable endpoint before enabling operation downloads. */
export class NetworkQualification {
  /** Retains cancellation and the exact installed sandbox executable being qualified. */
  constructor(
    private readonly executable: string,
    private readonly signal: AbortSignal,
  ) {}

  /** Requires an allowed read while proving proxied writes and direct-network bypass never reach the endpoint. */
  async run(source: string, root: string): Promise<void> {
    const requests: string[] = [];
    const server = createServer((request, response) => {
      requests.push(`${request.method} ${request.url}`);
      response.end('qualified-read');
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing qualification listener');
      await this.probe(source, root, `http://127.0.0.1:${address.port}`);
      if (JSON.stringify(requests) !== JSON.stringify(['GET /read']))
        throw new Error('Network confinement qualification failed: unexpected endpoint access');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  /** Uses a private disposable profile; real operation domains and source permissions remain captured separately. */
  private async probe(source: string, root: string, url: string): Promise<void> {
    const adapter = new SourceConfinement({
      workspace: source,
      reads: ['.'],
      outputs: [],
      temporaryRoot: join(root, 'network-private'),
      executable: this.executable,
      network: { domains: ['127.0.0.1'] },
    });
    const log = join(root, 'network-qualification.log');
    const script = this.script(url);
    const result = await execute(
      adapter.command({ command: process.execPath, args: ['-e', script] }),
      source,
      log,
      this.signal,
      {
        processScope: true,
        fileOutput: true,
        env: adapter.environment({ PATH: process.env.PATH }),
      },
    );
    if (result.exitCode !== 0 || !readFileSync(log, 'utf8').includes('proxy-qualified'))
      throw new Error('Network confinement qualification failed; inspect ' + log);
  }

  /** Exercises actual child processes with both proxy use and explicit bypass, using only a host-owned endpoint. */
  private script(url: string): string {
    return `const {spawnSync}=require('node:child_process');
const call=(args,path)=>spawnSync('curl',['--silent','--show-error','--fail','--max-time','3',...args,${JSON.stringify(url)}+path],{encoding:'utf8'});
const read=call([], '/read');
if(read.status!==0||read.stdout!=='qualified-read')throw Error('Allowed proxy read failed: '+read.stderr);
const write=call(['-X','POST'], '/write');
if(write.status===0)throw Error('Proxied write was allowed');
const direct=call(['--noproxy','*','-X','POST'], '/direct');
if(direct.status===0||direct.status===28)throw Error('Direct denial was not established');
console.log('proxy-qualified');`;
  }
}
