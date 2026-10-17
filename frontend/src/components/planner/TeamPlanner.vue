<script setup lang="ts">
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue';
import type { CalendarEntry, TeamCalendar } from '@/api/types';
import {
  daysInclusive,
  daysOfMonth,
  formatLongDate,
  formatRange,
  isWeekend,
  todayIso,
  weekdayInitial,
} from '@/utils/dates';

/**
 * Wall-planner style team calendar: one row per teammate, one column per day.
 * Approved time off is a solid marker stroke, pending time off is hatched, today is marked in sun
 * yellow and the bottom row shows how many people are away each day (coverage at a glance).
 */
const props = defineProps<{
  calendar: TeamCalendar;
  month: string;
  currentUserId?: string;
  showPending: boolean;
}>();

const days = computed(() => daysOfMonth(props.month));
const today = todayIso();
const gridStyle = computed(() => ({
  gridTemplateColumns: `minmax(7rem, 11rem) repeat(${days.value.length}, minmax(2.1rem, 1fr))`,
}));

const visibleEntries = computed(() =>
  props.calendar.entries.filter((entry) => props.showPending || entry.status === 'approved'),
);

interface Segment {
  entry: CalendarEntry;
  column: string;
  clippedStart: boolean;
  clippedEnd: boolean;
  label: string;
  wide: boolean;
}

const rows = computed(() => {
  const first = days.value[0] ?? '';
  const last = days.value[days.value.length - 1] ?? '';
  // Members with the current user first, so "my" row is always easy to find.
  const members = [...props.calendar.members].sort(
    (a, b) => Number(b.id === props.currentUserId) - Number(a.id === props.currentUserId),
  );

  return members.map((member) => {
    const segments: Segment[] = visibleEntries.value
      .filter(
        (entry) => entry.userId === member.id && entry.endDate >= first && entry.startDate <= last,
      )
      .map((entry) => {
        const start = entry.startDate < first ? first : entry.startDate;
        const end = entry.endDate > last ? last : entry.endDate;
        const startIndex = days.value.indexOf(start);
        const span = daysInclusive(start, end);
        const total = daysInclusive(entry.startDate, entry.endDate);
        return {
          entry,
          column: `${startIndex + 2} / span ${span}`,
          clippedStart: entry.startDate < first,
          clippedEnd: entry.endDate > last,
          wide: span >= 2,
          label: `${member.name}: ${entry.status} vacation, ${formatRange(entry.startDate, entry.endDate)} (${total} days)`,
        };
      });
    return { member, segments, isMe: member.id === props.currentUserId };
  });
});

/** Number of teammates away on each day of the month. */
const awayPerDay = computed(() =>
  days.value.map(
    (day) =>
      visibleEntries.value.filter((entry) => entry.startDate <= day && entry.endDate >= day).length,
  ),
);

const coverageClass = (count: number) =>
  count === 0
    ? 'text-transparent'
    : count === 1
      ? 'bg-sun-soft text-pending'
      : count === 2
        ? 'bg-[#f8dc9a] text-pending'
        : 'bg-sun text-ink';

const dayNumber = (day: string) => Number(day.slice(8));

/** Busiest days of the month, for the screen-reader summary of the coverage row. */
const busiestDays = computed(() => {
  const max = Math.max(0, ...awayPerDay.value);
  if (max < 2) return null;
  return {
    count: max,
    days: days.value.filter((_, index) => awayPerDay.value[index] === max).map(formatLongDate),
  };
});

/** On narrow screens, bring today's column into view instead of always starting on the 1st. */
const scroller = useTemplateRef<HTMLElement>('scroller');
async function revealToday() {
  await nextTick();
  const container = scroller.value;
  const todayCell = container?.querySelector<HTMLElement>('[data-today]');
  if (!container || !todayCell) return;
  const nameColumnWidth =
    container.querySelector<HTMLElement>('[data-name-column]')?.offsetWidth ?? 0;
  const cellOffset =
    todayCell.getBoundingClientRect().left -
    container.getBoundingClientRect().left +
    container.scrollLeft;
  // Keep two days of context visible to the left of today, clear of the sticky name column.
  container.scrollLeft = Math.max(0, cellOffset - nameColumnWidth - todayCell.offsetWidth * 2);
}
onMounted(revealToday);
watch(() => props.month, revealToday);
</script>

<template>
  <div
    ref="scroller"
    class="overflow-x-auto"
    tabindex="0"
    role="region"
    aria-label="Team planner grid, scroll horizontally for more days"
  >
    <!-- Screen readers get a structured summary; the visual wall chart is hidden from them. -->
    <div class="sr-only">
      <ul>
        <li v-for="row in rows" :key="row.member.id">
          {{ row.member.name }}{{ row.isMe ? ' (you)' : '' }}:
          <template v-if="row.segments.length">
            {{
              row.segments
                .map((segment) => segment.label.replace(`${row.member.name}: `, ''))
                .join('; ')
            }}
          </template>
          <template v-else>no time off this month</template>
        </li>
      </ul>
      <p v-if="busiestDays">
        Busiest {{ busiestDays.days.length === 1 ? 'day' : 'days' }}, with
        {{ busiestDays.count }} people away: {{ busiestDays.days.join(', ') }}.
      </p>
    </div>

    <div class="min-w-max" aria-hidden="true">
      <!-- Day header -->
      <div class="grid border-b border-line" :style="gridStyle">
        <div
          data-name-column
          class="sticky left-0 z-20 bg-surface px-4 py-2 text-sm font-semibold text-ink-faint"
        >
          Teammate
        </div>
        <div
          v-for="day in days"
          :key="day"
          :data-today="day === today || undefined"
          class="flex flex-col items-center py-1.5 text-xs"
          :class="isWeekend(day) ? 'bg-paper text-ink-faint' : 'text-ink-soft'"
        >
          <span>{{ weekdayInitial(day) }}</span>
          <span
            class="mt-0.5 flex size-6 items-center justify-center rounded-full font-display text-sm tabular-nums"
            :class="day === today ? 'bg-sun font-bold text-ink' : 'font-semibold'"
          >
            {{ dayNumber(day) }}
          </span>
        </div>
      </div>

      <!-- One row per teammate -->
      <div
        v-for="row in rows"
        :key="row.member.id"
        class="grid border-b border-line/70"
        :style="gridStyle"
      >
        <div
          class="sticky left-0 z-20 flex items-center gap-2 truncate px-4 py-2.5 text-sm"
          :class="row.isMe ? 'bg-lagoon-50 font-semibold text-lagoon-800' : 'bg-surface text-ink'"
          style="grid-row: 1"
        >
          <span class="truncate">{{ row.member.name }}</span>
          <span
            v-if="row.isMe"
            class="rounded bg-lagoon-600 px-1.5 text-[0.7rem] leading-4 text-white"
            >You</span
          >
        </div>
        <div
          v-for="(day, index) in days"
          :key="day"
          style="grid-row: 1"
          :style="{ gridColumn: index + 2 }"
          :class="[
            isWeekend(day) && 'bg-paper',
            day === today && 'bg-sun-soft/70',
            row.isMe && !isWeekend(day) && day !== today && 'bg-lagoon-50/40',
          ]"
          aria-hidden="true"
        />
        <div
          v-for="segment in row.segments"
          :key="segment.entry.id"
          :title="segment.label"
          class="z-10 mx-0.5 my-2 flex h-7 items-center overflow-hidden px-2 text-xs font-semibold"
          style="grid-row: 1"
          :style="{ gridColumn: segment.column }"
          :class="[
            segment.entry.status === 'approved'
              ? 'bg-lagoon-600 text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]'
              : 'pending-stroke text-lagoon-800',
            segment.clippedStart ? 'ml-0 rounded-l-none' : 'rounded-l-full',
            segment.clippedEnd ? 'mr-0 rounded-r-none' : 'rounded-r-full',
          ]"
        >
          <span v-if="segment.wide" class="truncate">
            {{ daysInclusive(segment.entry.startDate, segment.entry.endDate) }}d
          </span>
        </div>
      </div>

      <!-- Coverage row -->
      <div class="grid" :style="gridStyle">
        <div class="sticky left-0 z-20 bg-surface px-4 py-2 text-sm font-semibold text-ink-soft">
          Away per day
        </div>
        <div v-for="(count, index) in awayPerDay" :key="index" class="p-0.5">
          <div
            class="flex h-7 items-center justify-center rounded-md font-display text-sm font-semibold tabular-nums"
            :class="coverageClass(count)"
          >
            {{ count }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pending-stroke {
  background: repeating-linear-gradient(
    135deg,
    var(--color-lagoon-100) 0 5px,
    var(--color-lagoon-50) 5px 10px
  );
  box-shadow: inset 0 0 0 1.5px var(--color-lagoon-500);
}
</style>
