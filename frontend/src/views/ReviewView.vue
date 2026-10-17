<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { usersApi, vacationRequestsApi } from '@/api/endpoints';
import { type ApiError, toApiError } from '@/api/http';
import type { User, VacationRequest, VacationRequestStatus } from '@/api/types';
import PageHeader from '@/components/PageHeader.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorBanner from '@/components/ui/ErrorBanner.vue';
import FilterTabs from '@/components/ui/FilterTabs.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import DecisionDialog from '@/components/vacation/DecisionDialog.vue';
import type { Decision } from '@/components/vacation/decision';
import ReviewTable from '@/components/vacation/ReviewTable.vue';
import { useAsync } from '@/composables/useAsync';
import { enumField, intField, stringField, useQueryState } from '@/composables/useQueryState';
import { useToastStore } from '@/stores/toasts';

type StatusFilter = 'all' | VacationRequestStatus;
type SortOption = 'newest' | 'soonest';

const toasts = useToastStore();
const UUID = /^[0-9a-f-]{36}$/i;

const { state: filters, update: updateFilters } = useQueryState({
  status: enumField<StatusFilter>(['all', 'pending', 'approved', 'rejected'], 'all'),
  user: stringField('', UUID),
  sort: enumField<SortOption>(['newest', 'soonest'], 'newest'),
  page: intField(1),
  pageSize: intField(10, 1, 100),
});

const list = useAsync(() =>
  vacationRequestsApi.list({
    status: filters.value.status === 'all' ? undefined : filters.value.status,
    userId: filters.value.user || undefined,
    page: filters.value.page,
    pageSize: filters.value.pageSize,
    ...(filters.value.sort === 'soonest'
      ? { sort: 'startDate', order: 'asc' }
      : { sort: 'createdAt', order: 'desc' }),
  }),
);
const stats = useAsync(vacationRequestsApi.stats);
const users = ref<User[]>([]);

onMounted(async () => {
  void stats.run();
  users.value = await usersApi.list('requester').catch(() => []);
});
watch(filters, () => void list.run(), { immediate: true, deep: true });

const tabs = computed(() => [
  { value: 'all' as const, label: 'All', count: stats.data.value?.total },
  { value: 'pending' as const, label: 'Pending', count: stats.data.value?.pending },
  { value: 'approved' as const, label: 'Approved', count: stats.data.value?.approved },
  { value: 'rejected' as const, label: 'Rejected', count: stats.data.value?.rejected },
]);

const hasFilters = computed(() => filters.value.status !== 'all' || !!filters.value.user);

// ─── Decisions ────────────────────────────────────────────────────────────────
const target = shallowRef<VacationRequest | null>(null);
const decision = ref<Decision>('approve');
const deciding = ref(false);
const decisionError = shallowRef<ApiError | null>(null);

function openDecision(request: VacationRequest, kind: Decision) {
  target.value = request;
  decision.value = kind;
  decisionError.value = null;
}

async function confirmDecision(comment: string) {
  if (!target.value) return;
  deciding.value = true;
  decisionError.value = null;
  try {
    const request = target.value;
    if (decision.value === 'approve') await vacationRequestsApi.approve(request.id, comment);
    else await vacationRequestsApi.reject(request.id, comment);
    toasts.success(
      decision.value === 'approve' ? 'Request approved' : 'Request rejected',
      `${request.requester.name} has been notified.`,
    );
    target.value = null;
    await Promise.all([list.run(), stats.run()]);
  } catch (error) {
    decisionError.value = toApiError(error);
    // Someone else decided first: refresh so the list reflects reality.
    if (decisionError.value.code === 'REQUEST_ALREADY_DECIDED') void list.run();
  } finally {
    deciding.value = false;
  }
}
</script>

<template>
  <PageHeader
    title="Review requests"
    subtitle="Approve or reject your team’s vacation requests. Check the team planner for overlaps first."
  />

  <div class="space-y-4">
    <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <FilterTabs
        :model-value="filters.status"
        :options="tabs"
        label="Filter by status"
        @update:model-value="updateFilters({ status: $event })"
      />
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label class="sr-only" for="user-filter">Filter by requester</label>
        <select
          id="user-filter"
          class="control sm:w-56"
          :value="filters.user"
          @change="updateFilters({ user: ($event.target as HTMLSelectElement).value })"
        >
          <option value="">Everyone</option>
          <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
        </select>
        <label class="sr-only" for="sort">Sort requests</label>
        <select
          id="sort"
          class="control sm:w-52"
          :value="filters.sort"
          @change="
            updateFilters({ sort: ($event.target as HTMLSelectElement).value as SortOption })
          "
        >
          <option value="newest">Newest submitted</option>
          <option value="soonest">Soonest start date</option>
        </select>
      </div>
    </div>

    <ErrorBanner v-if="list.error.value" :error="list.error.value" @retry="list.run()" />

    <div v-else class="panel overflow-hidden" :aria-busy="list.loading.value">
      <div v-if="list.loading.value && !list.data.value" class="space-y-3 p-5" aria-label="Loading">
        <div v-for="n in 4" :key="n" class="h-14 animate-pulse rounded-lg bg-paper" />
      </div>
      <template v-else-if="list.data.value">
        <EmptyState
          v-if="list.data.value.data.length === 0"
          :title="
            filters.status === 'pending' && !filters.user
              ? 'You’re all caught up'
              : 'No matching requests'
          "
          :message="
            hasFilters
              ? 'Try another status or requester.'
              : 'New requests will appear here as soon as they’re submitted.'
          "
        >
          <button
            v-if="hasFilters"
            type="button"
            class="font-semibold text-lagoon-700 hover:underline"
            @click="updateFilters({ status: 'all', user: '' })"
          >
            Clear filters
          </button>
        </EmptyState>
        <ReviewTable
          v-else
          :class="list.loading.value && 'opacity-60 transition-opacity'"
          :requests="list.data.value.data"
          @approve="openDecision($event, 'approve')"
          @reject="openDecision($event, 'reject')"
        />
      </template>
    </div>

    <PaginationBar
      v-if="list.data.value"
      :meta="list.data.value.meta"
      @page="updateFilters({ page: $event })"
      @page-size="updateFilters({ pageSize: $event })"
    />
  </div>

  <DecisionDialog
    :request="target"
    :decision="decision"
    :submitting="deciding"
    :error="decisionError"
    @confirm="confirmDecision"
    @close="target = null"
  />
</template>
