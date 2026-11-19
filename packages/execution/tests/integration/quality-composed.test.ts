import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, globSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test, { type TestContext } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { parse } from 'yaml';
import type { AgentInspection } from '../../../architecture/src/index.js';
import { hasOwnerTestSuites, selectQualityInputs } from '../../../foundation/src/index.js';
import { ActivationTools } from '../../src/activation-tools.js';
import { LocalMcp } from '../../src/mcp.js';
import { StewardFixture } from '../fixtures/steward.js';

type Binding = AgentInspection['request']['options']['tools'][number];

/** Define the wire schema for the fixture's captured operations. */
function binding(name: string, handler: string, properties: Record<string, object>): Binding {
  return {
    name,
    handler,
    description: name,
    inputSchema: {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  } as Binding;
}

/** Return the actual response from the connected MCP client. */
async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  assert(!result.isError, JSON.stringify(result));
  return JSON.parse((result.content as { text: string }[])[0]!.text);
}

/** Find a real owner with lint inputs and no test suites using Foundation's selection. */
async function discover(root: string) {
  const components = Object.fromEntries(
    globSync('.arc/architecture/components/*.yaml').map((path) => {
      const component = parse(readFileSync(path, 'utf8')) as { id: string; owns: string[] };
      return [component.id, component];
    }),
  );
  for (const owner of Object.keys(components)) {
    const selection = await selectQualityInputs('lint', owner);
    const file = selection.files.find((path) => path.endsWith('.ts'));
    if (file && !hasOwnerTestSuites(root, owner, Object.values(components)))
      return { owner, file, components };
  }
  throw new Error('Fixture requires a lintable owner without test suites');
}

/** Connect a real client to the normal activation tool dispatcher. */
async function connect(activation: ActivationTools) {
  const check = { expected: { type: 'string' } };
  const bindings = [
    binding('owner-lint', 'check', check),
    binding('repository-types', 'check', check),
    binding('checked-edit', 'edit', {
      path: { type: 'string' },
      expected: { type: 'string' },
      content: { type: 'string' },
    }),
  ];
  const host = new LocalMcp(
    bindings,
    (tool, args) => activation.invoke(tool, args),
    () => {},
  );
  const client = new Client({ name: 'quality-composition', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(await host.start())));
  return { client, host };
}

/** Run real tools in the outer sandbox without claiming native confinement. */
function installDiagnosticBoundary(
  t: TestContext,
  task: StewardFixture['task'],
  owner: string,
  workspace: string,
) {
  // This controlled boundary runs real tools under the outer test sandbox; it does not
  // exercise HostTask's inner confinement or its production evidence cache.
  t.mock.method(
    task,
    'check',
    async (id: string, _signal: AbortSignal, scope?: Parameters<typeof task.check>[2]) => {
      const args = id === 'owner-lint' ? ['run', 'lint', '--', owner] : ['run', 'check'];
      const start = Date.now();
      const result = spawnSync('npm', args, { cwd: workspace, encoding: 'utf8' });
      const log = task.store(`${id}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
      const check = {
        id,
        status: result.status ?? -1,
        log,
        command: 'npm',
        args,
        cwd: workspace,
        durationMs: Date.now() - start,
      };
      task.note({ check, scope, diagnosticComposition: { signal: result.signal } });
      return check;
    },
  );
}

test('real lint and type diagnostics reach one MCP caller and survive checked repair', async (t) => {
  const { task, owner, file, workspace, original, broken } = await diagnosticFixture(t);
  installDiagnosticBoundary(t, task, owner, workspace);
  const activation = new ActivationTools(
    task,
    { component: owner, activity: 'implementation' },
    {
      goal: 'quality',
      assignment: {},
      milestone: { id: 'quality' },
      acceptance: [],
      worktree: workspace,
    },
    AbortSignal.timeout(120_000),
  );
  const { client, host } = await connect(activation);
  try {
    await assertRepair(client, file, original, broken);
  } finally {
    await client.close();
    await host.close();
  }
});

/** Prepare a captured owner and inject lint and type failures. */
async function diagnosticFixture(t: TestContext) {
  const source = process.cwd();
  const { owner, file, components } = await discover(source);
  const root = mkdtempSync(join(tmpdir(), 'arcnexus-quality-composed-'));
  const workspace = join(root, 'workspace');
  prepareWorkspace(source, workspace);
  const task = new StewardFixture(t, root).task;
  t.after(() => task.close());
  task.worktree = workspace;
  Object.assign(task.capture, { components, source: { ...task.capture.source, root: source } });
  const original = readFileSync(join(workspace, file), 'utf8');
  const lines = Array.from({ length: 35 }, () => '  value += 1;').join('\n');
  const broken =
    original +
    `\nfunction qualityFailure(): number {\n  let value: number = "wrong";\n${lines}\n  return value;\n}\nqualityFailure();\n`;
  writeFileSync(join(workspace, file), broken);

  return { task, owner, file, workspace, original, broken };
}

/** Check diagnostics, repair through the same caller, and retain earlier logs. */
async function assertRepair(client: Client, file: string, original: string, broken: string) {
  const lint = await call(client, 'owner-lint', { expected: 'pass' });
  const types = await call(client, 'repository-types', { expected: 'pass' });
  assert.notEqual(lint.status, 0);
  assert.notEqual(types.status, 0);
  const lintLog = readFileSync(lint.log, 'utf8');
  const typeLog = readFileSync(types.log, 'utf8');
  assert.match(lintLog, /max-lines-per-function|too many lines/i);
  assert.match(typeLog, /TS2322/);
  assert(lintLog.includes(file));
  assert(typeLog.includes(file));
  const receipt = await call(client, 'checked-edit', {
    path: file,
    expected: createHash('sha256').update(broken).digest('hex'),
    content: original,
  });
  assert.equal(receipt.path, file);
  const fixedLint = await call(client, 'owner-lint', { expected: 'pass' });
  const fixedTypes = await call(client, 'repository-types', { expected: 'pass' });
  assert.equal(fixedLint.status, 0, readFileSync(fixedLint.log, 'utf8'));
  assert.equal(fixedTypes.status, 0, readFileSync(fixedTypes.log, 'utf8'));
  assert.notEqual(lint.log, fixedLint.log);
  assert.notEqual(types.log, fixedTypes.log);
  assert.equal(readFileSync(lint.log, 'utf8'), lintLog);
  assert.equal(readFileSync(types.log, 'utf8'), typeLog);
}

/** Copy source into an isolated workspace and attach installed dependencies. */
function prepareWorkspace(source: string, workspace: string): void {
  cpSync(source, workspace, {
    recursive: true,
    filter: (path) =>
      !['.git', 'node_modules', 'dist'].includes(relative(source, path).split('/')[0]!),
  });
  symlinkSync(join(source, 'node_modules'), join(workspace, 'node_modules'), 'dir');
}
