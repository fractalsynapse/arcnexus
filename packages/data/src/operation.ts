import type { z } from 'zod';

export interface DataScope {
  readonly principal: string;
  readonly project: string;
}

export interface DataOperation<
  Input extends z.ZodType = z.ZodType,
  Output extends z.ZodType = z.ZodType,
> {
  readonly input: Input;
  readonly output: Output;
  readonly execute: (scope: DataScope, value: unknown) => Promise<z.output<Output>>;
}

export interface DataResource<
  Operations extends Record<string, DataOperation> = Record<string, DataOperation>,
> {
  readonly id: string;
  readonly operations: Readonly<Operations>;
}

/** Validate both sides of the owner operation using the published schemas. */
export function dataOperation<Input extends z.ZodType, Output extends z.ZodType>(
  input: Input,
  output: Output,
  handle: (
    scope: DataScope,
    value: z.output<Input>,
  ) => z.output<Output> | Promise<z.output<Output>>,
): DataOperation<Input, Output> {
  return {
    input,
    output,
    execute: async (scope, value) =>
      output.parseAsync(await handle(scope, await input.parseAsync(value))),
  };
}
