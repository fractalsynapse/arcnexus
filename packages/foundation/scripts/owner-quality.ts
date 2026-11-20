import { Quality } from '../src/index.js';

try {
  const [operation, owner, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Expected a quality operation and optional owner');
  process.exitCode = await new Quality(process.cwd()).run(operation, owner);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
