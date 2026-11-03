import { InputError } from '../../library/architecture/config.js';

/** Converts CLI assignments to structured application inputs without interpreting shell expressions. */
export function architectureFields(inputs: string[]): Record<string, unknown> {
  if (!inputs.length) throw new InputError('At least one field=value is required');
  const fields: Record<string, unknown> = Object.create(null);
  for (const input of inputs) {
    const separator = input.indexOf('=');
    const key = input.slice(0, separator);
    if (separator < 1 || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(key))
      throw new InputError('Expected field=value: ' + input);
    if (Object.hasOwn(fields, key)) throw new InputError('Duplicate field: ' + key);
    const text = input.slice(separator + 1);
    try {
      fields[key] = JSON.parse(text);
    } catch {
      fields[key] = text;
    }
  }
  return fields;
}
