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
  if (!validate(value))
    throw new SchemaValidationError(name, failureDetail(name, value, validate.errors ?? []));
  return value as T;
}

/**
 * Reports the branch the author was clearly aiming at.
 *
 * `oneOf` describes every branch, so a component whose only fault is one missing activity field is
 * also reported against the branches it does not use - naming the keys those branches require as if
 * they were the offense, which sent several rounds of fixture work chasing fields that were already
 * correct. When a schema discriminates its branches on a property the value carries, that branch is
 * re-checked alone so the message names the real fault first. Acceptance is untouched: this runs only
 * after the full schema has already rejected the value, and if no single branch matches, the original
 * aggregate is reported as before.
 */
function failureDetail(
  name: string,
  value: unknown,
  errors: { instancePath: string; message?: string; params: Record<string, unknown> }[],
): string {
  const branch = matchingBranch(name, value);
  if (branch) {
    const validateBranch = compileBranch(`${name}#${branchKey(branch)}`, branch);
    if (!validateBranch(value)) return describe(validateBranch.errors ?? []);
  }
  return describe(errors);
}

/** The one `oneOf` branch whose discriminator equals the value's, or undefined when ambiguous. */
function matchingBranch(name: string, value: unknown): any {
  const declared = (value as { [key: string]: unknown } | null)?.type;
  if (typeof declared !== 'string') return undefined;
  const branches: any[] = readSchema(name)?.oneOf ?? [];
  const matches = branches.filter((branch) => declaresType(branch?.properties?.type, declared));
  return matches.length === 1 ? matches[0] : undefined;
}

function declaresType(spec: any, declared: string): boolean {
  if (!spec) return false;
  if (spec.const !== undefined) return spec.const === declared;
  return Array.isArray(spec.enum) && spec.enum.includes(declared);
}

function branchKey(branch: any): string {
  const spec = branch?.properties?.type ?? {};
  return String(spec.const ?? (spec.enum ?? []).join('-'));
}

const branchValidators = new Map<string, ReturnType<typeof ajv.compile>>();

function compileBranch(key: string, branch: unknown) {
  let validate = branchValidators.get(key);
  if (!validate) {
    validate = ajv.compile(branch as object);
    branchValidators.set(key, validate);
  }
  return validate;
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
