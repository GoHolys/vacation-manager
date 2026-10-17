<script setup lang="ts">
import type { ApiError } from '@/api/http';

defineProps<{ error: ApiError; title?: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-xl border border-rejected-line bg-rejected-bg/60 p-4 sm:flex-row sm:items-center sm:justify-between"
    role="alert"
  >
    <div>
      <p class="font-semibold text-rejected">{{ title ?? "Couldn't load this data" }}</p>
      <p class="text-sm text-ink-soft">{{ error.message }}</p>
    </div>
    <button
      type="button"
      class="self-start rounded-lg px-3 py-1.5 text-sm font-semibold text-rejected hover:bg-rejected-bg sm:self-auto"
      @click="$emit('retry')"
    >
      Try again
    </button>
  </div>
</template>
