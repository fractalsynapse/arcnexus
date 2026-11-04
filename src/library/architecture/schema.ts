import { Ajv2020 } from 'ajv/dist/2020.js';
import { PackagedSchemas } from './packaged-schemas.js';

const ajv = new Ajv2020({ strict: true, allErrors: true });

const validators = new Map<string, ReturnType<typeof ajv.compile>>();

/** Distinguishes invalid caller input from schema loading or validator configuration failures. */
export class SchemaValidationError extends Error {
  /** Retains the failed schema and validation detail without classifying transport or filesystem errors as input. */
  constructor(
    readonly schema: string,
    detail: string,
  ) {
    super(`Invalid ${schema}: ${detail}`);
  }
}

/** Loads trusted, packaged schemas rather than target-authored configuration. */
export function readSchema(name: string): any {
  return new PackagedSchemas().read(name);
}

export function validateSchema<T>(name: string, value: unknown): T {
  let validate = validators.get(name);
  if (!validate) {
    validate = ajv.compile(readSchema(name));
    validators.set(name, validate);
  }
  if (!validate(value)) throw new SchemaValidationError(name, ajv.errorsText(validate.errors));
  return value as T;
}
