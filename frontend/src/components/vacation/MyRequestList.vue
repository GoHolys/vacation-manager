<script setup lang="ts">
import type { VacationRequest } from '@/api/types';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { formatRelative } from '@/utils/dates';
import DateRange from './DateRange.vue';
import DecisionNote from './DecisionNote.vue';

defineProps<{ requests: VacationRequest[]; editingId?: string | null }>();
defineEmits<{ edit: [request: VacationRequest]; cancel: [request: VacationRequest] }>();
</script>

<template>
  <ul class="divide-y divide-line">
    <li
      v-for="request in requests"
      :key="request.id"
      class="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
      :class="editingId === request.id && 'bg-lagoon-50/60'"
    >
      <div class="flex min-w-0 flex-col gap-2">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <DateRange :start="request.startDate" :end="request.endDate" :days="request.days" />
        </div>
        <p v-if="request.reason" class="text-ink-soft">{{ request.reason }}</p>
        <DecisionNote :request="request" />
        <p class="text-xs text-ink-faint">Submitted {{ formatRelative(request.createdAt) }}</p>
      </div>

      <div class="flex items-center gap-2 sm:flex-col sm:items-end">
        <StatusBadge :status="request.status" />
        <div v-if="request.status !== 'approved'" class="ml-auto flex gap-1 sm:ml-0">
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-sm font-semibold text-lagoon-700 hover:bg-lagoon-50"
            @click="$emit('edit', request)"
          >
            {{ request.status === 'rejected' ? 'Edit & resubmit' : 'Edit' }}
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-sm font-semibold text-ink-soft hover:bg-rejected-bg hover:text-rejected"
            @click="$emit('cancel', request)"
          >
            Cancel
          </button>
        </div>
        <p
          v-else
          class="ml-auto flex items-center gap-1 text-xs text-ink-faint sm:ml-0"
          title="Approved requests can't be changed"
        >
          <svg class="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect
              x="3.5"
              y="7"
              width="9"
              height="6.5"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.4"
            />
            <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" stroke-width="1.4" />
          </svg>
          Locked once approved
        </p>
      </div>
    </li>
  </ul>
</template>
