<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { teamCalendarApi } from '@/api/endpoints';
import PageHeader from '@/components/PageHeader.vue';
import TeamPlanner from '@/components/planner/TeamPlanner.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ErrorBanner from '@/components/ui/ErrorBanner.vue';
import { useAsync } from '@/composables/useAsync';
import { stringField, useQueryState } from '@/composables/useQueryState';
import { useAuthStore } from '@/stores/auth';
import { currentMonth, formatMonth, monthBounds, shiftMonth, todayIso } from '@/utils/dates';

const auth = useAuthStore();
const thisMonth = currentMonth();
const { state, update } = useQueryState({
  month: stringField(thisMonth, /^\d{4}-(0[1-9]|1[0-2])$/),
});
const showPending = ref(true);

const calendar = useAsync((month: string) => {
  const { from, to } = monthBounds(month);
  return teamCalendarApi.get(from, to);
});
watch(
  () => state.value.month,
  (month) => void calendar.run(month),
  { immediate: true },
);

/** "Who's away today?" — the question people open a planner to answer. */
const awayToday = computed(() => {
  const data = calendar.data.value;
  const today = todayIso();
  if (!data || today < data.from || today > data.to) return null;
  const ids = new Set(
    data.entries
      .filter(
        (e) =>
          e.startDate <= today &&
          e.endDate >= today &&
          (showPending.value || e.status === 'approved'),
      )
      .map((e) => e.userId),
  );
  return data.members.filter((member) => ids.has(member.id)).map((member) => member.name);
});
</script>

<template>
  <PageHeader
    title="Team planner"
    subtitle="See who’s away and when, so requests and approvals don’t leave the team short-handed."
  />

  <section class="panel overflow-hidden" aria-labelledby="month-title">
    <div
      class="flex flex-col gap-4 border-b border-line p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex size-9 items-center justify-center rounded-lg hover:bg-ink/5"
          aria-label="Previous month"
          @click="update({ month: shiftMonth(state.month, -1) })"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M10 3.5 5.5 8l4.5 4.5"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <h2 id="month-title" class="min-w-44 text-center text-2xl font-bold" aria-live="polite">
          {{ formatMonth(state.month) }}
        </h2>
        <button
          type="button"
          class="inline-flex size-9 items-center justify-center rounded-lg hover:bg-ink/5"
          aria-label="Next month"
          @click="update({ month: shiftMonth(state.month, 1) })"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              stroke-width="1.75"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <BaseButton
          v-if="state.month !== thisMonth"
          size="sm"
          class="ml-1"
          @click="update({ month: thisMonth })"
        >
          This month
        </BaseButton>
      </div>

      <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft">
        <span class="flex items-center gap-2">
          <span class="h-3 w-6 rounded-full bg-lagoon-600" aria-hidden="true" /> Approved
        </span>
        <span class="flex items-center gap-2">
          <span class="legend-pending h-3 w-6 rounded-full" aria-hidden="true" /> Pending
        </span>
        <span class="flex items-center gap-2">
          <span class="size-3 rounded-full bg-sun" aria-hidden="true" /> Today
        </span>
        <label class="flex cursor-pointer items-center gap-2 font-semibold text-ink">
          <input v-model="showPending" type="checkbox" class="size-4 accent-lagoon-600" />
          Show pending
        </label>
      </div>
    </div>

    <p v-if="awayToday" class="border-b border-line bg-sun-soft/50 px-5 py-2.5 text-sm">
      <template v-if="awayToday.length">
        <strong class="font-semibold">Away today:</strong> {{ awayToday.join(', ') }}
      </template>
      <template v-else>Everyone is in today.</template>
    </p>

    <div v-if="calendar.error.value" class="p-5">
      <ErrorBanner :error="calendar.error.value" @retry="calendar.run(state.month)" />
    </div>
    <div v-else-if="!calendar.data.value" class="space-y-2 p-5" aria-label="Loading">
      <div v-for="n in 6" :key="n" class="h-9 animate-pulse rounded-lg bg-paper" />
    </div>
    <EmptyState
      v-else-if="calendar.data.value.members.length === 0"
      title="No teammates yet"
      message="Once requesters join, their time off appears here."
    />
    <TeamPlanner
      v-else
      :class="calendar.loading.value && 'opacity-60 transition-opacity'"
      :calendar="calendar.data.value"
      :month="state.month"
      :current-user-id="auth.user?.id"
      :show-pending="showPending"
    />
  </section>
</template>

<style scoped>
.legend-pending {
  background: repeating-linear-gradient(
    135deg,
    var(--color-lagoon-100) 0 3px,
    var(--color-lagoon-50) 3px 6px
  );
  box-shadow: inset 0 0 0 1.5px var(--color-lagoon-500);
}
</style>
