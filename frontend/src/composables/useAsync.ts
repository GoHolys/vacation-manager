import { ref, shallowRef } from 'vue';
import { type ApiError, toApiError } from '@/api/http';

/**
 * Wraps an async loader with `data` / `loading` / `error` state.
 * Responses that arrive out of order (fast filter changes) are discarded.
 */
export function useAsync<T, A extends unknown[]>(loader: (...args: A) => Promise<T>) {
  const data = shallowRef<T>();
  const error = shallowRef<ApiError | null>(null);
  const loading = ref(false);
  let latestCall = 0;

  async function run(...args: A): Promise<T | undefined> {
    const call = ++latestCall;
    loading.value = true;
    error.value = null;
    try {
      const result = await loader(...args);
      if (call === latestCall) data.value = result;
      return result;
    } catch (caught) {
      if (call === latestCall) error.value = toApiError(caught);
      return undefined;
    } finally {
      if (call === latestCall) loading.value = false;
    }
  }

  return { data, error, loading, run };
}
