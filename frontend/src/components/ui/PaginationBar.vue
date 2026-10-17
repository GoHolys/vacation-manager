<script setup lang="ts">
import { computed } from 'vue';
import type { PageMeta } from '@/api/types';

const props = withDefaults(defineProps<{ meta: PageMeta; pageSizes?: number[] }>(), {
  pageSizes: () => [10, 20, 50],
});

const emit = defineEmits<{ page: [page: number]; pageSize: [size: number] }>();

const range = computed(() => {
  const { page, pageSize, totalItems } = props.meta;
  if (totalItems === 0) return null;
  const first = (page - 1) * pageSize + 1;
  return { first, last: Math.min(first + pageSize - 1, totalItems), total: totalItems };
});

/** Compact page list: 1 … 4 5 6 … 12 */
const pages = computed<(number | 'gap')[]>(() => {
  const { page, totalPages } = props.meta;
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const result: (number | 'gap')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) result.push('gap');
  for (let p = start; p <= end; p++) result.push(p);
  if (end < totalPages - 1) result.push('gap');
  result.push(totalPages);
  return result;
});

const navButton =
  'inline-flex size-9 items-center justify-center rounded-lg text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40';
</script>

<template>
  <nav
    v-if="range"
    class="flex flex-col-reverse items-center justify-between gap-3 sm:flex-row"
    aria-label="Pagination"
  >
    <div class="flex items-center gap-3 text-sm text-ink-soft">
      <span>
        <span class="font-semibold text-ink tabular-nums">{{ range.first }}–{{ range.last }}</span>
        of <span class="tabular-nums">{{ range.total }}</span>
      </span>
      <label class="flex items-center gap-2">
        <span class="sr-only sm:not-sr-only">Rows</span>
        <select
          class="control h-9 w-auto py-1 pr-8 text-sm"
          :value="meta.pageSize"
          @change="emit('pageSize', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        :class="[navButton, 'hover:bg-ink/5']"
        :disabled="meta.page <= 1"
        aria-label="Previous page"
        @click="emit('page', meta.page - 1)"
      >
        <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M10 3.5 5.5 8l4.5 4.5"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <template v-for="(item, index) in pages" :key="`${item}-${index}`">
        <span v-if="item === 'gap'" class="px-1 text-ink-faint" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          :class="[navButton, item === meta.page ? 'bg-lagoon-600 text-white' : 'hover:bg-ink/5']"
          :aria-current="item === meta.page ? 'page' : undefined"
          :aria-label="`Page ${item}`"
          @click="emit('page', item)"
        >
          {{ item }}
        </button>
      </template>
      <button
        type="button"
        :class="[navButton, 'hover:bg-ink/5']"
        :disabled="meta.page >= meta.totalPages"
        aria-label="Next page"
        @click="emit('page', meta.page + 1)"
      >
        <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M6 3.5 10.5 8 6 12.5"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  </nav>
</template>
