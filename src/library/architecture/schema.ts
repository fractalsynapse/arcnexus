import { Ajv2020 } from 'ajv/dist/2020.js';
import { PackagedSchemas } from './packaged-schemas.js';

const ajv = new Ajv2020({ strict: true, allErrors: true });

const validators = new Map<string, ReturnType<typeof ajv.compile>>();

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
  if (!validate(value)) throw new Error(`Invalid ${name}: ${ajv.errorsText(validate.errors)}`);
  return value as T;
}
