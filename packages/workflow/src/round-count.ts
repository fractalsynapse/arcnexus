/** Exact positive base-ten round value at the application and JSON boundaries. */
export type RoundCount = string;

/** Validate decimal operands without converting them through floating-point numbers. */
export function roundCount(value: unknown): RoundCount | undefined {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) return undefined;
  const normalized = value.replace(/^0+/, '');
  return normalized || undefined;
}

/** Interpret old numeric records as their represented integer without rewriting history. */
export function recordedRound(value: unknown): RoundCount {
  const decimal =
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0
      ? BigInt(value).toString()
      : roundCount(value);
  if (!decimal) throw new Error('Invalid retained refinement round count');
  return decimal;
}
