<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { ApiError } from '@/api/http';
import type { VacationRequest, VacationRequestInput } from '@/api/types';
import BaseButton from '@/components/ui/BaseButton.vue';
import FormField from '@/components/ui/FormField.vue';
import {
  addDays,
  daysInclusive,
  formatLongDate,
  formatRange,
  isWeekend,
  todayIso,
  workingDays,
} from '@/utils/dates';

const REASON_MAX_LENGTH = 500;

const props = defineProps<{
  /** When set, the form edits this request instead of creating a new one. */
  request?: VacationRequest | null;
  submitting?: boolean;
  serverError?: ApiError | null;
}>();

const emit = defineEmits<{ submit: [input: VacationRequestInput]; cancelEdit: [] }>();

const form = reactive({ startDate: '', endDate: '', reason: '' });
const attempted = ref(false);
const today = todayIso();

watch(
  () => props.request,
  (request) => {
    form.startDate = request?.startDate ?? '';
    form.endDate = request?.endDate ?? '';
    form.reason = request?.reason ?? '';
    attempted.value = false;
  },
  { immediate: true },
);

// Picking a start date pre-fills a sensible end date (the next day) when none is chosen yet.
watch(
  () => form.startDate,
  (start) => {
    if (start && !form.endDate) form.endDate = addDays(start, 1);
  },
);

/** Client-side mirror of the business rules, for instant feedback. The API stays authoritative. */
const clientErrors = computed(() => {
  const errors: Partial<Record<'startDate' | 'endDate' | 'reason', string>> = {};
  if (!form.startDate) errors.startDate = 'Choose the first day of your vacation.';
  else if (form.startDate < today) errors.startDate = 'Vacations can’t start in the past.';
  if (!form.endDate) errors.endDate = 'Choose the last day of your vacation.';
  else if (form.startDate && form.endDate <= form.startDate)
    errors.endDate = 'The end date must be after the start date.';
  if (form.reason.length > REASON_MAX_LENGTH)
    errors.reason = `Keep it under ${REASON_MAX_LENGTH} characters.`;
  return errors;
});

const serverFieldErrors = computed(() => props.serverError?.fieldErrors ?? {});
const fieldError = (field: 'startDate' | 'endDate' | 'reason') =>
  (attempted.value ? clientErrors.value[field] : undefined) ??
  serverFieldErrors.value[field] ??
  null;

const overlaps = computed(() =>
  props.serverError?.code === 'VACATION_OVERLAP'
    ? props.serverError.details.filter((detail) => typeof detail.startDate === 'string')
    : [],
);
const formError = computed(() =>
  props.serverError && !Object.keys(serverFieldErrors.value).length ? props.serverError : null,
);

const summary = computed(() => {
  if (!form.startDate || !form.endDate || form.endDate <= form.startDate) return null;
  let back = addDays(form.endDate, 1);
  while (isWeekend(back)) back = addDays(back, 1);
  return {
    days: daysInclusive(form.startDate, form.endDate),
    working: workingDays(form.startDate, form.endDate),
    back: formatLongDate(back),
  };
});

function onSubmit() {
  attempted.value = true;
  if (Object.keys(clientErrors.value).length > 0) return;
  emit('submit', {
    startDate: form.startDate,
    endDate: form.endDate,
    reason: form.reason.trim() || null,
  });
}

/** Lets the parent clear the form after a successful creation. */
function reset() {
  form.startDate = '';
  form.endDate = '';
  form.reason = '';
  attempted.value = false;
}

defineExpose({ reset });
</script>

<template>
  <form class="space-y-5" novalidate @submit.prevent="onSubmit">
    <div class="grid grid-cols-2 gap-3">
      <FormField v-slot="attrs" label="First day" :error="fieldError('startDate')">
        <input
          v-bind="attrs"
          v-model="form.startDate"
          type="date"
          class="control"
          :min="today"
          required
        />
      </FormField>
      <FormField v-slot="attrs" label="Last day" :error="fieldError('endDate')">
        <input
          v-bind="attrs"
          v-model="form.endDate"
          type="date"
          class="control"
          :min="form.startDate ? addDays(form.startDate, 1) : today"
          required
        />
      </FormField>
    </div>

    <p
      v-if="summary"
      class="rounded-lg bg-lagoon-50 px-3 py-2 text-sm text-lagoon-800"
      aria-live="polite"
    >
      <strong class="font-semibold">{{ summary.days }} days away</strong>
      ({{ summary.working }} working {{ summary.working === 1 ? 'day' : 'days' }}). Back on
      {{ summary.back }}.
    </p>

    <FormField
      v-slot="attrs"
      label="Reason"
      optional
      :error="fieldError('reason')"
      hint="Only you and validators can see this."
    >
      <textarea
        v-bind="attrs"
        v-model="form.reason"
        rows="3"
        class="control resize-y"
        :maxlength="REASON_MAX_LENGTH + 50"
        placeholder="Family trip, moving house…"
      />
    </FormField>
    <p
      class="-mt-3 text-right text-xs tabular-nums"
      :class="form.reason.length > REASON_MAX_LENGTH ? 'text-rejected' : 'text-ink-faint'"
    >
      {{ form.reason.length }}/{{ REASON_MAX_LENGTH }}
    </p>

    <div
      v-if="overlaps.length"
      class="rounded-lg border border-pending-line bg-pending-bg px-3 py-2.5 text-sm"
      role="alert"
    >
      <p class="font-semibold text-pending">These dates clash with another request</p>
      <ul class="mt-1 space-y-0.5 text-ink-soft">
        <li v-for="overlap in overlaps" :key="String(overlap.requestId)">
          {{ formatRange(String(overlap.startDate), String(overlap.endDate)) }} ({{
            overlap.status
          }})
        </li>
      </ul>
    </div>
    <p
      v-else-if="formError"
      class="rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected"
      role="alert"
    >
      {{ formError.message }}
    </p>

    <div class="flex gap-2">
      <BaseButton type="submit" variant="primary" :loading="submitting" block>
        {{
          request
            ? request.status === 'rejected'
              ? 'Resubmit request'
              : 'Save changes'
            : 'Submit request'
        }}
      </BaseButton>
      <BaseButton v-if="request" variant="ghost" @click="emit('cancelEdit')">Discard</BaseButton>
    </div>
  </form>
</template>
