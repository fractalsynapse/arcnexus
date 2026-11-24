import type { Context } from 'cordis';
import { z } from 'zod';
import type { DataOperation, DataResource, DataScope } from './operation.js';
export {
  dataOperation,
  type DataOperation,
  type DataResource,
  type DataScope,
} from './operation.js';

export interface DataAccess {
  readonly scope: DataScope;
  readonly resource: string;
  readonly operation: string;
}

export type AuthorizeData = (access: DataAccess) => boolean | Promise<boolean>;
export type ResolveDataScope<Credential> = (
  credential: Credential,
  project: string,
) => DataScope | undefined | Promise<DataScope | undefined>;

declare module 'cordis' {
  interface Context {
    data: Data;
  }
}

/** Bind trusted model registrations to one project-scoped discovery and invocation contract. */
export class Data {
  private readonly resources = new Map<string, DataResource>();

  /** Receive the trusted authorization policy used by every adapter. */
  constructor(private readonly authorize: AuthorizeData) {}

  /** Publish each model once and unpublish it when its owner is disposed. */
  register(resource: DataResource) {
    if (this.resources.has(resource.id))
      throw new Error('Data resource already registered: ' + resource.id);
    this.resources.set(resource.id, resource);
    return () => {
      if (this.resources.get(resource.id) === resource) this.resources.delete(resource.id);
    };
  }

  /** Report whether a registered operation is available under the same policy as invocation. */
  async allows(scope: DataScope, resource: string, operation: string) {
    const registered = this.resources.get(resource);
    return Boolean(
      registered &&
      Object.hasOwn(registered.operations, operation) &&
      (await this.authorize({ scope, resource, operation })),
    );
  }

  /** Describe authorized operations using the schemas executed at runtime. */
  async describe(scope: DataScope) {
    const visible = [];
    for (const [resource, registration] of this.resources) {
      for (const [operation, definition] of Object.entries(registration.operations)) {
        if (await this.authorize({ scope, resource, operation }))
          visible.push({
            resource,
            operation,
            input: z.toJSONSchema(definition.input, { io: 'input' }),
            output: z.toJSONSchema(definition.output, { io: 'output' }),
          });
      }
    }
    return visible;
  }

  /** Execute an authorized operation against its registered owner. */
  invoke<
    Operations extends Record<string, DataOperation>,
    Operation extends keyof Operations & string,
  >(
    scope: DataScope,
    resource: DataResource<Operations>,
    operation: Operation,
    value: z.input<Operations[Operation]['input']>,
  ): Promise<z.output<Operations[Operation]['output']>>;

  /** Resolve adapter-supplied names at runtime with the same schema checks. */
  invoke(scope: DataScope, resource: string, operation: string, value: unknown): Promise<unknown>;

  /** Validate the scope before resolving the selected model and accepting its input. */
  async invoke(
    scope: DataScope,
    resource: string | DataResource,
    operation: string,
    value: unknown,
  ) {
    const id = typeof resource === 'string' ? resource : resource.id;
    if (!(await this.authorize({ scope, resource: id, operation })))
      throw new Error('Data operation not authorized');
    const registration = this.resources.get(id);
    if (
      !registration ||
      (typeof resource !== 'string' && resource !== registration) ||
      !Object.hasOwn(registration.operations, operation)
    )
      throw new Error('Data operation unavailable: ' + id + '.' + operation);
    return registration.operations[operation]!.execute(scope, value);
  }
}

export function dataPlugin(authorize: AuthorizeData) {
  return {
    /** Publish the shared Data service without activating a network adapter. */
    apply(context: Context) {
      context.provide('data', new Data(authorize));
    },
  };
}
