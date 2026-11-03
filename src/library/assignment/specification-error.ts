/** Identifies a completed, scope-checked regression validation failure that permits specification correction. */
export class SpecificationValidationError extends Error {
  /** Retains the observed diagnostic separately from the stable progress failure identity. */
  constructor(
    readonly feedback: string,
    readonly identity: string,
    message = 'Regression did not fail with the expected assertion',
  ) {
    super(message);
    this.name = 'SpecificationValidationError';
  }
}
