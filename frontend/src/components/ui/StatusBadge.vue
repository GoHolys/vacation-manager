<script setup lang="ts">
import { computed } from 'vue';
import type { VacationRequestStatus } from '@/api/types';

const props = defineProps<{ status: VacationRequestStatus }>();

/** Colour + distinct icon + text: status is readable without relying on colour. */
const STYLES: Record<VacationRequestStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-pending-bg text-pending ring-pending-line' },
  approved: { label: 'Approved', classes: 'bg-approved-bg text-approved ring-approved-line' },
  rejected: { label: 'Rejected', classes: 'bg-rejected-bg text-rejected ring-rejected-line' },
};

const style = computed(() => STYLES[props.status]);
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ring-inset"
    :class="style.classes"
  >
    <svg
      v-if="status === 'pending'"
      class="size-3.5"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" />
      <path
        d="M8 4.75V8l2.25 1.5"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
    <svg
      v-else-if="status === 'approved'"
      class="size-3.5"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m3.5 8.5 3 3 6-7"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <svg v-else class="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m4.5 4.5 7 7m0-7-7 7"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
      />
    </svg>
    {{ style.label }}
  </span>
</template>
