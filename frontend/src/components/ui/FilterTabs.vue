<script setup lang="ts" generic="T extends string">
/** Segmented filter whose options show live counts (they replace separate "stat cards"). */
defineProps<{
  options: { value: T; label: string; count?: number }[];
  label: string;
}>();

const model = defineModel<T>({ required: true });
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="grid w-full grid-cols-2 gap-1 rounded-xl bg-ink/[0.045] p-1 sm:inline-flex sm:w-auto"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
      :class="
        model === option.value
          ? 'bg-surface text-ink shadow-(--shadow-panel)'
          : 'text-ink-soft hover:text-ink'
      "
      @click="model = option.value"
    >
      {{ option.label }}
      <span
        v-if="option.count !== undefined"
        class="min-w-6 rounded-full px-1.5 text-center text-xs tabular-nums"
        :class="
          model === option.value ? 'bg-lagoon-50 text-lagoon-700' : 'bg-ink/[0.06] text-ink-soft'
        "
      >
        {{ option.count }}
      </span>
    </button>
  </div>
</template>
