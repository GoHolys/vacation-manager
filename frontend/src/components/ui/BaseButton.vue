<script setup lang="ts">
import { computed } from 'vue';
import SpinnerIcon from './SpinnerIcon.vue';

type Variant = 'primary' | 'secondary' | 'ghost' | 'approve' | 'reject' | 'danger';

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: 'sm' | 'md';
    type?: 'button' | 'submit';
    loading?: boolean;
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    variant: 'secondary',
    size: 'md',
    type: 'button',
    loading: false,
    disabled: false,
    block: false,
  },
);

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-lagoon-600 text-white hover:bg-lagoon-700 active:bg-lagoon-800 shadow-xs',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-paper shadow-xs',
  ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink',
  approve:
    'bg-approved-bg text-approved border border-approved-line hover:bg-approved hover:text-white hover:border-approved',
  reject: 'bg-surface text-rejected border border-rejected-line hover:bg-rejected-bg',
  danger: 'bg-rejected text-white hover:bg-rejected/90 shadow-xs',
};

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap transition-colors',
  'disabled:cursor-not-allowed disabled:opacity-55',
  props.size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4',
  props.block && 'w-full',
  VARIANTS[props.variant],
]);
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <SpinnerIcon v-if="loading" class="size-4" />
    <slot />
  </button>
</template>
