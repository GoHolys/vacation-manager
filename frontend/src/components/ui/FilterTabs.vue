<script setup lang="ts" generic="T extends string">
import { nextTick, useTemplateRef } from 'vue';

/**
 * Segmented filter whose options show live counts (they replace separate "stat cards").
 * Implements the WAI-ARIA radio-group pattern: one tab stop, arrow keys / Home / End move and select.
 */
const props = defineProps<{
  options: { value: T; label: string; count?: number }[];
  label: string;
}>();

const model = defineModel<T>({ required: true });
const buttons = useTemplateRef<HTMLButtonElement[]>('buttons');

async function onKeydown(event: KeyboardEvent, index: number) {
  const last = props.options.length - 1;
  const target =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? index === last
        ? 0
        : index + 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? index === 0
          ? last
          : index - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : null;
  if (target === null) return;
  event.preventDefault();
  const option = props.options[target];
  if (!option) return;
  model.value = option.value;
  await nextTick();
  buttons.value?.[target]?.focus();
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="grid w-full grid-cols-2 gap-1 rounded-xl bg-ink/[0.045] p-1 sm:inline-flex sm:w-auto"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      ref="buttons"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :tabindex="model === option.value ? 0 : -1"
      class="flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
      :class="
        model === option.value
          ? 'bg-surface text-ink shadow-(--shadow-panel)'
          : 'text-ink-soft hover:text-ink'
      "
      @click="model = option.value"
      @keydown="onKeydown($event, index)"
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
