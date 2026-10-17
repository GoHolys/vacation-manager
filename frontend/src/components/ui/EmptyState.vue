<script setup lang="ts">
defineProps<{ title: string; message?: string }>();
</script>

<template>
  <div class="flex flex-col items-center px-6 py-14 text-center">
    <svg class="mb-4 h-14 w-20 text-line-strong" viewBox="0 0 80 56" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="78" height="54" rx="8" stroke="currentColor" stroke-width="2" />
      <path d="M1 15h78" stroke="currentColor" stroke-width="2" />
      <rect x="12" y="24" width="30" height="7" rx="3.5" fill="#cbe9e7" />
      <rect x="30" y="37" width="36" height="7" rx="3.5" fill="#fdf1d6" />
    </svg>
    <h3 class="text-lg font-semibold">{{ title }}</h3>
    <p v-if="message" class="mt-1 max-w-sm text-ink-soft">{{ message }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
