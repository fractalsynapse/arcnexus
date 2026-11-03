import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Supplies the controlled runtime's MCP inventory through the same CLI preflight protocol. */
export class ControlledClient {
  /** Handles inventory only; model turns continue through the existing scripted boundaries. */
  static inventory(args: string[], version: string): boolean {
    if (args[0] === '--version') {
      console.log(version);
      return true;
    }
    if (args[0] === 'features') return this.features();
    if (args[0] !== 'mcp' || args[1] !== 'list') return false;
    console.log(
      JSON.stringify([
        {
          name: 'arcnexus',
          enabled: true,
          transport: {
            type: 'stdio',
            command: this.value(args, 'command'),
            args: this.value(args, 'args'),
            env: null,
            env_vars: [],
            cwd: null,
          },
        },
      ]),
    );
    return true;
  }

  /** Reports the captured private feature policy at the controlled CLI boundary. */
  private static features(): boolean {
    const config = readFileSync(join(process.env.CODEX_HOME!, 'config.toml'), 'utf8');
    for (const line of config.split('\n').filter((line) => line.endsWith('=false')))
      console.log(line.replace('=false', ' stable false'));
    return true;
  }

  /** Reads one literal bridge override supplied by the production host. */
  private static value(args: string[], key: string): unknown {
    const argument = args.find((arg) => arg.startsWith(`mcp_servers.arcnexus.${key}=`))!;
    return JSON.parse(argument.slice(argument.indexOf('=') + 1));
  }
}
