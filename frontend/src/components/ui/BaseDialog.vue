<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue';

/**
 * Modal built on the native <dialog> element: focus trapping, Escape-to-close, inert background
 * and top-layer stacking come from the browser instead of hand-rolled JavaScript.
 */
const props = defineProps<{ open: boolean; title: string; description?: string }>();
const emit = defineEmits<{ close: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
const descriptionId = useId();

watch(
  () => props.open,
  async (open) => {
    await nextTick();
    const element = dialog.value;
    if (!element) return;
    if (open && !element.open) element.showModal?.();
    if (!open && element.open) element.close?.();
  },
  { immediate: true },
);

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close');
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-ink shadow-(--shadow-pop) backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descriptionId : undefined"
    @cancel.prevent="emit('close')"
    @click="onBackdropClick"
  >
    <div v-if="open" class="p-6">
      <h2 :id="titleId" class="text-xl font-semibold">{{ title }}</h2>
      <p v-if="description" :id="descriptionId" class="mt-1.5 text-ink-soft">{{ description }}</p>
      <div class="mt-5">
        <slot />
      </div>
      <div
        v-if="$slots.actions"
        class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
      >
        <slot name="actions" />
      </div>
    </div>
  </dialog>
</template>
