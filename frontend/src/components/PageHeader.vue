<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:mb-8">
    <div>
      <h1 class="text-3xl font-bold sm:text-[2.125rem]">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1.5 max-w-prose text-ink-soft">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 items-center gap-2">
      <slot />
    </div>
  </div>
</template>
