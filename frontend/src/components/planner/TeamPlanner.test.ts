import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { TeamCalendar } from '@/api/types';
import TeamPlanner from './TeamPlanner.vue';

const calendar: TeamCalendar = {
  from: '2030-02-01',
  to: '2030-02-28',
  members: [
    { id: 'a', name: 'Alice Requester' },
    { id: 'b', name: 'Bob Requester' },
    { id: 'c', name: 'Cara Requester' },
  ],
  entries: [
    { id: '1', userId: 'a', startDate: '2030-02-04', endDate: '2030-02-08', status: 'approved' },
    { id: '2', userId: 'b', startDate: '2030-02-06', endDate: '2030-02-07', status: 'pending' },
    // Starts in January: clipped to the visible month.
    { id: '3', userId: 'a', startDate: '2030-01-28', endDate: '2030-02-02', status: 'approved' },
  ],
};

const mountPlanner = (showPending = true) =>
  mount(TeamPlanner, { props: { calendar, month: '2030-02', currentUserId: 'b', showPending } });

describe('TeamPlanner', () => {
  it('gives screen readers a structured summary and hides the visual grid from them', () => {
    const wrapper = mountPlanner();
    const summary = wrapper.find('.sr-only').text();
    expect(summary).toContain(
      'Bob Requester (you): pending vacation, Wed 6 Feb – Thu 7 Feb 2030 (2 days)',
    );
    expect(summary).toContain('Cara Requester: no time off this month');
    expect(summary).toContain('Busiest days, with 2 people away: Wed 6 Feb 2030, Thu 7 Feb 2030.');
    expect(wrapper.find('[aria-hidden="true"].min-w-max').exists()).toBe(true);
  });

  it('lists the current user first and can hide pending requests', () => {
    const wrapper = mountPlanner(false);
    const items = wrapper.findAll('.sr-only li').map((li) => li.text());
    expect(items[0]).toMatch(/^Bob Requester \(you\): no time off/);
  });

  it('counts people away per day, including clipped requests', () => {
    const wrapper = mountPlanner();
    const counts = wrapper.findAll('.tabular-nums.rounded-md').map((cell) => Number(cell.text()));
    expect(counts.slice(0, 8)).toEqual([1, 1, 0, 1, 1, 2, 2, 1]);
  });
});
