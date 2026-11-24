import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { Architecture } from '../../architecture/src/index.js';
import { importSchema } from '../../catalog/src/index.js';

const configuration = z.strictObject({
  operator: z.string().min(1),
  projects: z.array(
    z.strictObject({ directory: z.string().min(1), remote: importSchema.shape.remote }),
  ),
});

export function bindings(file: string) {
  const config = configuration.parse(JSON.parse(readFileSync(file, 'utf8')) as unknown);
  const projects = new Map(config.projects.map((project) => [project.remote, project.directory]));
  if (projects.size !== config.projects.length) throw new Error('Duplicate project binding');
  const architecture = new Architecture();
  return {
    operator: config.operator,
    capture(remote: string, revision?: string) {
      const directory = projects.get(remote);
      if (!directory) return undefined;
      const capture = architecture.capture(directory, revision);
      if (capture.source.remote !== remote) throw new Error('Bound project remote changed');
      return capture;
    },
  };
}
