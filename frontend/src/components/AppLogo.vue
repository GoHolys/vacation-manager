<script setup lang="ts">
withDefaults(defineProps<{ inverted?: boolean }>(), { inverted: false });
</script>

<template>
  <span class="inline-flex items-center gap-2">
    <svg class="size-8" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" :fill="inverted ? '#ffffff' : '#0e6f73'" />
      <circle cx="21" cy="11" r="4.5" fill="#f2b33d" />
      <rect x="6" y="18" width="14" height="4" rx="2" :fill="inverted ? '#0e6f73' : '#ffffff'" />
      <rect
        x="10"
        y="24"
        width="16"
        height="4"
        rx="2"
        :fill="inverted ? '#0e6f73' : '#ffffff'"
        fill-opacity=".55"
      />
    </svg>
    <span
      class="font-display text-2xl font-bold tracking-tight"
      :class="inverted ? 'text-white' : 'text-ink'"
    >
      Away
    </span>
  </span>
</template>
