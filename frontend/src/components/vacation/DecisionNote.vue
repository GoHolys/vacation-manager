<script setup lang="ts">
import type { VacationRequest } from '@/api/types';
import { formatDate } from '@/utils/dates';

/** Who decided, when, and what they said. */
defineProps<{ request: VacationRequest; compact?: boolean }>();
</script>

<template>
  <div v-if="request.decidedBy || request.comments" class="text-sm">
    <p v-if="request.decidedBy && !compact" class="text-ink-faint">
      {{ request.status === 'approved' ? 'Approved' : 'Rejected' }} by
      {{ request.decidedBy.name }}
      <template v-if="request.decidedAt">
        on {{ formatDate(request.decidedAt.slice(0, 10)) }}</template
      >
    </p>
    <blockquote
      v-if="request.comments"
      class="mt-1 border-l-2 pl-2.5 text-ink-soft"
      :class="request.status === 'rejected' ? 'border-rejected-line' : 'border-approved-line'"
    >
      “{{ request.comments }}”
    </blockquote>
  </div>
</template>
