import { InputError } from '../architecture/config.js';

/** Applies explicit operator substitutions without modifying captured profile authority. */
export function modelSelection(requestedModel: string) {
  const source = process.env.ARCNEXUS_MODEL_SUBSTITUTIONS;
  if (source === undefined) return { requestedModel, model: requestedModel };
  let substitutions: Record<string, string>;
  try {
    substitutions = JSON.parse(source);
    if (
      !substitutions ||
      Array.isArray(substitutions) ||
      typeof substitutions !== 'object' ||
      Object.entries(substitutions).some(
        ([key, value]) => !key.trim() || typeof value !== 'string' || !value.trim(),
      )
    )
      throw new Error('Expected nonempty model names');
  } catch {
    throw new InputError('ARCNEXUS_MODEL_SUBSTITUTIONS must map model names to nonempty strings');
  }
  const model = Object.hasOwn(substitutions, requestedModel)
    ? substitutions[requestedModel]!
    : requestedModel;
  return { requestedModel, model };
}
