<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ApiError } from '@/api/http';
import type { VacationRequest } from '@/api/types';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import FormField from '@/components/ui/FormField.vue';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import DateRange from './DateRange.vue';

import type { Decision } from './decision';

const COMMENT_MAX_LENGTH = 1000;
const REJECTION_SUGGESTIONS = [
  'Too many teammates are already away on these dates.',
  'This overlaps a release or deadline. Could you pick other dates?',
  'Please give a bit more notice for a request this long.',
];

const props = defineProps<{
  request: VacationRequest | null;
  decision: Decision;
  submitting?: boolean;
  error?: ApiError | null;
}>();

const emit = defineEmits<{ confirm: [comment: string]; close: [] }>();

const comment = ref('');
const attempted = ref(false);

watch(
  () => props.request,
  () => {
    comment.value = '';
    attempted.value = false;
  },
);

const isReject = computed(() => props.decision === 'reject');
const commentError = computed(() => {
  if (comment.value.length > COMMENT_MAX_LENGTH)
    return `Keep it under ${COMMENT_MAX_LENGTH} characters.`;
  if (isReject.value && attempted.value && !comment.value.trim())
    return 'Tell the requester why, so they can plan around it.';
  return props.error?.fieldErrors.comment ?? null;
});

function confirm() {
  attempted.value = true;
  if (commentError.value) return;
  emit('confirm', comment.value.trim());
}
</script>

<template>
  <BaseDialog
    :open="!!request"
    :title="isReject ? 'Reject this request?' : 'Approve this request?'"
    :description="
      isReject
        ? 'The requester will see your comment and can edit and resubmit the request.'
        : 'Approved requests are final and can no longer be edited.'
    "
    @close="emit('close')"
  >
    <template v-if="request">
      <div class="flex items-start gap-3 rounded-xl bg-paper p-3">
        <UserAvatar :name="request.requester.name" />
        <div class="min-w-0">
          <p class="font-semibold">{{ request.requester.name }}</p>
          <DateRange :start="request.startDate" :end="request.endDate" :days="request.days" />
          <p v-if="request.reason" class="mt-1 text-sm text-ink-soft">{{ request.reason }}</p>
        </div>
      </div>

      <form id="decision-form" class="mt-5" novalidate @submit.prevent="confirm">
        <FormField
          v-slot="attrs"
          :label="isReject ? 'Reason for rejecting' : 'Note to the requester'"
          :optional="!isReject"
          :error="commentError"
        >
          <textarea
            v-bind="attrs"
            v-model="comment"
            rows="3"
            class="control resize-y"
            :required="isReject"
            :placeholder="isReject ? 'Explain why these dates don’t work…' : 'Enjoy your time off!'"
          />
        </FormField>
        <div v-if="isReject" class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="suggestion in REJECTION_SUGGESTIONS"
            :key="suggestion"
            type="button"
            class="rounded-full border border-line-strong px-3 py-1 text-left text-xs text-ink-soft hover:border-lagoon-500 hover:text-ink"
            @click="comment = suggestion"
          >
            {{ suggestion }}
          </button>
        </div>
      </form>

      <p
        v-if="error && !error.fieldErrors.comment"
        class="mt-4 rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected"
        role="alert"
      >
        {{ error.message }}
      </p>
    </template>

    <template #actions>
      <BaseButton variant="ghost" @click="emit('close')">Keep reviewing</BaseButton>
      <BaseButton
        type="submit"
        form="decision-form"
        :variant="isReject ? 'danger' : 'primary'"
        :loading="submitting"
      >
        {{ isReject ? 'Reject request' : 'Approve request' }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
