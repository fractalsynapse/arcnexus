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
  if (!validate(value)) throw new SchemaValidationError(name, describe(validate.errors ?? []));
  return value as T;
}

/**
 * Describes validation failures with the exact location and rule that failed.
 *
 * `ajv.errorsText` reports the rule but not where it fired, so an author told "data must NOT have
 * additional properties" for a twelve-key document has to guess which key and which branch. Naming
 * the instance path and the offending parameter turns an architecture error into something a person
 * can fix without reading the schema source.
 */
function describe(
  errors: { instancePath: string; message?: string; params: Record<string, unknown> }[],
): string {
  return errors
    .slice(0, 6)
    .map((error) => {
      const where = error.instancePath || '#';
      const found = [
        error.params.additionalProperty,
        error.params.missingProperty,
        error.params.allowedValues,
        error.params.comparison,
      ].find((candidate) => candidate !== undefined);
      const detail = Array.isArray(found) ? found.join('|') : (found ?? '');
      return `${where}: ${error.message}${detail ? ` (${detail})` : ''}`;
    })
    .join('; ');
}
