import { computed } from 'vue';
import { type LocationQuery, useRoute, useRouter } from 'vue-router';

/**
 * Keeps list filters in the URL (?status=pending&page=2): views are shareable, survive reloads
 * and the browser back button behaves as users expect.
 */
export interface QueryField<T> {
  defaultValue: T;
  parse(raw: unknown): T;
}

export const enumField = <T extends string>(
  values: readonly T[],
  defaultValue: T,
): QueryField<T> => ({
  defaultValue,
  parse: (raw) => (values.includes(raw as T) ? (raw as T) : defaultValue),
});

export const intField = (
  defaultValue: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): QueryField<number> => ({
  defaultValue,
  parse: (raw) => {
    const value = Number.parseInt(String(raw ?? ''), 10);
    return Number.isFinite(value) && value >= min && value <= max ? value : defaultValue;
  },
});

export const stringField = (defaultValue = '', pattern?: RegExp): QueryField<string> => ({
  defaultValue,
  parse: (raw) => (typeof raw === 'string' && (!pattern || pattern.test(raw)) ? raw : defaultValue),
});

type StateOf<S extends Record<string, QueryField<unknown>>> = {
  [K in keyof S]: S[K] extends QueryField<infer T> ? T : never;
};

export function useQueryState<S extends Record<string, QueryField<unknown>>>(schema: S) {
  const route = useRoute();
  const router = useRouter();

  const state = computed(
    () =>
      Object.fromEntries(
        Object.entries(schema).map(([key, field]) => [key, field.parse(route.query[key])]),
      ) as StateOf<S>,
  );

  /** Applies several changes in one navigation. Changing a filter resets pagination. */
  function update(patch: Partial<StateOf<S>>): void {
    const query: LocationQuery = { ...route.query };
    for (const [key, value] of Object.entries(patch)) {
      const field = schema[key];
      if (!field) continue;
      if (value === field.defaultValue || value === '' || value === undefined) delete query[key];
      else query[key] = String(value);
    }
    if ('page' in schema && !('page' in patch)) delete query.page;
    void router.replace({ query });
  }

  return { state, update };
}
