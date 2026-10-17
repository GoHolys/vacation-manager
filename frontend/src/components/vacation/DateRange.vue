<script setup lang="ts">
import { computed } from 'vue';
import { daysInclusive, formatRange } from '@/utils/dates';

const props = defineProps<{ start: string; end: string; days?: number }>();

const dayCount = computed(() => props.days ?? daysInclusive(props.start, props.end));
</script>

<template>
  <div>
    <p class="font-display font-semibold text-ink">{{ formatRange(start, end) }}</p>
    <p class="text-sm text-ink-faint">{{ dayCount }} {{ dayCount === 1 ? 'day' : 'days' }}</p>
  </div>
</template>
