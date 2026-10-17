<script setup lang="ts">
import { computed, useId } from 'vue';

/**
 * Accessible label / hint / error wrapper. The default slot receives the ids and ARIA attributes
 * to spread on the native control, so screen readers announce hints and errors correctly.
 */
const props = defineProps<{
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
}>();

const id = useId();
const hintId = `${id}-hint`;
const errorId = `${id}-error`;

const controlAttrs = computed(() => ({
  id,
  'aria-invalid': props.error ? ('true' as const) : undefined,
  'aria-describedby':
    [props.hint && hintId, props.error && errorId].filter(Boolean).join(' ') || undefined,
}));
</script>

<template>
  <div class="space-y-1.5">
    <label :for="id" class="flex items-baseline justify-between text-sm font-semibold text-ink">
      {{ label }}
      <span v-if="optional" class="text-xs font-normal text-ink-faint">Optional</span>
    </label>
    <slot v-bind="controlAttrs" />
    <p
      v-if="error"
      :id="errorId"
      class="flex items-start gap-1.5 text-sm text-rejected"
      role="alert"
    >
      <svg
        class="mt-0.5 size-4 shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.5a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4ZM10 14.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clip-rule="evenodd"
        />
      </svg>
      {{ error }}
    </p>
    <p v-else-if="hint" :id="hintId" class="text-sm text-ink-faint">{{ hint }}</p>
  </div>
</template>
