import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

const AUTO_DISMISS_MS = 5000;

export const useToastStore = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([]);
  let nextId = 1;

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  }

  function push(tone: ToastTone, title: string, message?: string): void {
    const id = nextId++;
    toasts.value = [...toasts.value.slice(-3), { id, tone, title, message }];
    setTimeout(() => dismiss(id), tone === 'error' ? AUTO_DISMISS_MS * 2 : AUTO_DISMISS_MS);
  }

  return {
    toasts,
    dismiss,
    success: (title: string, message?: string) => push('success', title, message),
    error: (title: string, message?: string) => push('error', title, message),
    info: (title: string, message?: string) => push('info', title, message),
  };
});
