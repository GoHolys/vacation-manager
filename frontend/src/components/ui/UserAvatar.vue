<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ name: string; size?: 'sm' | 'md' }>(), { size: 'md' });

/** Muted tints, chosen deterministically from the name so a person keeps their colour everywhere. */
const TINTS = [
  'bg-[#dbeafe] text-[#1e3a8a]',
  'bg-[#dcf2ea] text-[#14532d]',
  'bg-[#fde7d4] text-[#7c2d12]',
  'bg-[#ede4fb] text-[#4c1d95]',
  'bg-[#fce4ec] text-[#831843]',
  'bg-[#e0f2f1] text-[#0b5a5e]',
];

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(''),
);

const tint = computed(() => {
  const hash = [...props.name].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return TINTS[hash % TINTS.length];
});
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
    :class="[tint, size === 'sm' ? 'size-7 text-xs' : 'size-9 text-sm']"
    aria-hidden="true"
  >
    {{ initials }}
  </span>
</template>
