<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useToastStore } from '@/stores/toasts';

const store = useToastStore();
const { toasts } = storeToRefs(store);

const TONES = {
  success: 'border-l-approved',
  error: 'border-l-rejected',
  info: 'border-l-lagoon-500',
} as const;
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
    aria-live="polite"
    aria-atomic="false"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :role="toast.tone === 'error' ? 'alert' : 'status'"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-l-4 border-line bg-surface px-4 py-3 shadow-(--shadow-pop)"
        :class="TONES[toast.tone]"
      >
        <div class="min-w-0 flex-1">
          <p class="font-semibold">{{ toast.title }}</p>
          <p v-if="toast.message" class="text-sm text-ink-soft">{{ toast.message }}</p>
        </div>
        <button
          type="button"
          class="-mr-1 rounded-md p-1 text-ink-faint hover:bg-ink/5 hover:text-ink"
          aria-label="Dismiss notification"
          @click="store.dismiss(toast.id)"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="m4.5 4.5 7 7m0-7-7 7"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
