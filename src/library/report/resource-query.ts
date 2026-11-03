import { createHash } from 'node:crypto';
import { InputError } from '../architecture/config.js';

export interface ResourceQueryInput {
  filters?: string[];
  search?: string;
  limit?: number;
  cursor?: string;
}

type Fields = Record<string, readonly string[] | null>;

/** Applies typed equality filters and revision-bound pagination to shared resource projections. */
export class ResourceQuery {
  /** Returns a deterministic page and rejects cursors belonging to changed results or another query. */
  page<T extends object>(
    items: T[],
    fields: Fields,
    query: ResourceQueryInput = {},
    searchFields = Object.keys(fields),
  ) {
    const limit = query.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new InputError('List limit must be an integer from 1 through 100');
    const filters = this.filters(fields, query.filters ?? []);
    const search = query.search?.toLowerCase() ?? '';
    const selected = items.filter((item) => this.matches(item, searchFields, filters, search));
    const revision = this.revision({ filters, search, limit, selected });
    const offset = this.offset(query.cursor, revision, selected.length);
    const next = offset + limit;
    return {
      items: selected.slice(offset, next),
      revision,
      nextCursor:
        next < selected.length
          ? Buffer.from(JSON.stringify({ revision, offset: next })).toString('base64url')
          : null,
    };
  }

  /** Captures a stable token without depending on mutable global selection state. */
  revision(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  /** Allows only declared fields and lifecycle values, preserving equality and AND semantics. */
  private filters(fields: Fields, inputs: string[]): Array<[string, string]> {
    return inputs
      .map((input) => {
        const separator = input.indexOf('=');
        const key = input.slice(0, separator),
          value = input.slice(separator + 1);
        if (separator < 1 || !value || !Object.hasOwn(fields, key))
          throw new InputError('Unknown or malformed resource filter: ' + input);
        if (fields[key] && !fields[key]!.includes(value))
          throw new InputError('Invalid resource filter value: ' + input);
        return [key, value] as [string, string];
      })
      .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  }

  /** Searches only projected scalar fields and never evaluates caller expressions. */
  private matches(
    item: object,
    searchFields: string[],
    filters: Array<[string, string]>,
    search: string,
  ) {
    const values = item as Record<string, unknown>;
    return (
      filters.every(([key, value]) => values[key] === value) &&
      (!search ||
        searchFields.some(
          (key) => typeof values[key] === 'string' && values[key].toLowerCase().includes(search),
        ))
    );
  }

  /** Rejects malformed, stale or query-incompatible cursors before selecting a page. */
  private offset(cursor: string | undefined, revision: string, length: number): number {
    if (cursor === undefined) return 0;
    try {
      const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (
        value.revision !== revision ||
        !Number.isSafeInteger(value.offset) ||
        value.offset < 0 ||
        value.offset > length
      )
        throw new Error('Mismatch');
      return value.offset;
    } catch {
      throw new InputError('Invalid or stale cursor; restart the resource query');
    }
  }
}
