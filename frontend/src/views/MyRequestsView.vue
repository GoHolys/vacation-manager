<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { myRequestsApi, vacationRequestsApi } from '@/api/endpoints';
import { type ApiError, toApiError } from '@/api/http';
import type { VacationRequest, VacationRequestInput, VacationRequestStatus } from '@/api/types';
import PageHeader from '@/components/PageHeader.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseDialog from '@/components/ui/BaseDialog.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorBanner from '@/components/ui/ErrorBanner.vue';
import FilterTabs from '@/components/ui/FilterTabs.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import DateRange from '@/components/vacation/DateRange.vue';
import MyRequestList from '@/components/vacation/MyRequestList.vue';
import VacationRequestForm from '@/components/vacation/VacationRequestForm.vue';
import { useAsync } from '@/composables/useAsync';
import { enumField, intField, useQueryState } from '@/composables/useQueryState';
import { useToastStore } from '@/stores/toasts';

type StatusFilter = 'all' | VacationRequestStatus;

const toasts = useToastStore();
const { state: filters, update: updateFilters } = useQueryState({
  status: enumField<StatusFilter>(['all', 'pending', 'approved', 'rejected'], 'all'),
  page: intField(1),
  pageSize: intField(10, 1, 100),
});

const list = useAsync(() =>
  myRequestsApi.list({
    status: filters.value.status === 'all' ? undefined : filters.value.status,
    page: filters.value.page,
    pageSize: filters.value.pageSize,
    sort: 'startDate',
    order: 'desc',
  }),
);
const stats = useAsync(myRequestsApi.stats);
const refresh = () => Promise.all([list.run(), stats.run()]);

onMounted(() => void stats.run());
watch(filters, () => void list.run(), { immediate: true, deep: true });
// A stale or hand-edited URL (?page=99) lands on the last existing page instead of an empty list.
watch(list.data, (page) => {
  if (page && page.meta.totalPages > 0 && page.meta.page > page.meta.totalPages) {
    updateFilters({ page: page.meta.totalPages });
  }
});

const tabs = computed(() => [
  { value: 'all' as const, label: 'All', count: stats.data.value?.total },
  { value: 'pending' as const, label: 'Pending', count: stats.data.value?.pending },
  { value: 'approved' as const, label: 'Approved', count: stats.data.value?.approved },
  { value: 'rejected' as const, label: 'Rejected', count: stats.data.value?.rejected },
]);

// ─── Create / edit ────────────────────────────────────────────────────────────
const formRef = useTemplateRef<InstanceType<typeof VacationRequestForm>>('form');
const formPanel = useTemplateRef<HTMLElement>('formPanel');
const editing = shallowRef<VacationRequest | null>(null);
const saving = ref(false);
const saveError = shallowRef<ApiError | null>(null);

async function save(input: VacationRequestInput) {
  saving.value = true;
  saveError.value = null;
  try {
    if (editing.value) {
      await vacationRequestsApi.update(editing.value.id, input);
      toasts.success(
        editing.value.status === 'rejected' ? 'Request resubmitted' : 'Changes saved',
        'It’s waiting for a validator to review it.',
      );
      editing.value = null;
    } else {
      await vacationRequestsApi.create(input);
      toasts.success('Request submitted', 'A validator will review it soon.');
      formRef.value?.reset();
    }
    await refresh();
  } catch (error) {
    saveError.value = toApiError(error);
  } finally {
    saving.value = false;
  }
}

async function startEdit(request: VacationRequest) {
  editing.value = request;
  saveError.value = null;
  await nextTick();
  formPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  formPanel.value?.querySelector('input')?.focus({ preventScroll: true });
}

function stopEdit() {
  editing.value = null;
  saveError.value = null;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────
const cancelling = shallowRef<VacationRequest | null>(null);
const cancelBusy = ref(false);

async function confirmCancel() {
  if (!cancelling.value) return;
  cancelBusy.value = true;
  try {
    await vacationRequestsApi.cancel(cancelling.value.id);
    if (editing.value?.id === cancelling.value.id) stopEdit();
    toasts.success('Request cancelled');
    cancelling.value = null;
    // Stepping back a page if we just removed its last row.
    if (list.data.value?.data.length === 1 && filters.value.page > 1)
      updateFilters({ page: filters.value.page - 1 });
    await refresh();
  } catch (error) {
    toasts.error('Couldn’t cancel the request', toApiError(error).message);
  } finally {
    cancelBusy.value = false;
  }
}
</script>

<template>
  <PageHeader
    title="My requests"
    subtitle="Plan your time off and follow each request through review."
  />

  <div
    class="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]"
  >
    <section
      ref="formPanel"
      class="panel scroll-mt-24 p-5 lg:sticky lg:top-24"
      aria-labelledby="form-title"
    >
      <h2 id="form-title" class="text-xl font-semibold">
        {{
          editing
            ? editing.status === 'rejected'
              ? 'Edit and resubmit'
              : 'Edit request'
            : 'Request time off'
        }}
      </h2>
      <p class="mt-1 mb-5 text-sm text-ink-soft">
        {{
          editing
            ? 'Changing the dates sends the request back for review.'
            : 'Pick your first and last day away. Validators are notified right away.'
        }}
      </p>
      <VacationRequestForm
        ref="form"
        :request="editing"
        :submitting="saving"
        :server-error="saveError"
        @submit="save"
        @cancel-edit="stopEdit"
      />
    </section>

    <section class="min-w-0 space-y-4" aria-label="Your vacation requests">
      <FilterTabs
        :model-value="filters.status"
        :options="tabs"
        label="Filter by status"
        @update:model-value="updateFilters({ status: $event })"
      />

      <ErrorBanner v-if="list.error.value" :error="list.error.value" @retry="list.run()" />

      <div v-else class="panel overflow-hidden" :aria-busy="list.loading.value">
        <div
          v-if="list.loading.value && !list.data.value"
          class="space-y-3 p-5"
          aria-label="Loading"
        >
          <div v-for="n in 3" :key="n" class="h-16 animate-pulse rounded-lg bg-paper" />
        </div>
        <template v-else-if="list.data.value">
          <EmptyState
            v-if="list.data.value.data.length === 0"
            :title="filters.status === 'all' ? 'No requests yet' : `No ${filters.status} requests`"
            :message="
              filters.status === 'all'
                ? 'Use the form to request your first days off.'
                : 'Requests with this status will show up here.'
            "
          />
          <MyRequestList
            v-else
            :class="list.loading.value && 'opacity-60 transition-opacity'"
            :requests="list.data.value.data"
            :editing-id="editing?.id"
            @edit="startEdit"
            @cancel="cancelling = $event"
          />
        </template>
      </div>

      <PaginationBar
        v-if="list.data.value"
        :meta="list.data.value.meta"
        @page="updateFilters({ page: $event })"
        @page-size="updateFilters({ pageSize: $event })"
      />
    </section>
  </div>

  <BaseDialog
    :open="!!cancelling"
    title="Cancel this request?"
    description="It will be removed from your requests and the team planner."
    @close="cancelling = null"
  >
    <div v-if="cancelling" class="rounded-xl bg-paper p-3">
      <DateRange :start="cancelling.startDate" :end="cancelling.endDate" :days="cancelling.days" />
    </div>
    <template #actions>
      <BaseButton variant="ghost" @click="cancelling = null">Keep request</BaseButton>
      <BaseButton variant="danger" :loading="cancelBusy" @click="confirmCancel"
        >Cancel request</BaseButton
      >
    </template>
  </BaseDialog>
</template>
