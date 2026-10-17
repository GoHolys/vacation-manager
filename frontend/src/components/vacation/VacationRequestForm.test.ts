import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/http';
import { addDays, todayIso } from '@/utils/dates';
import VacationRequestForm from './VacationRequestForm.vue';

const today = todayIso();

async function fill(wrapper: ReturnType<typeof mount>, start: string, end: string, reason = '') {
  const [first, last] = wrapper.findAll('input[type="date"]');
  await first!.setValue(start);
  await last!.setValue(end);
  await wrapper.find('textarea').setValue(reason);
}

describe('VacationRequestForm', () => {
  it('blocks submission when the end date is not after the start date', async () => {
    const wrapper = mount(VacationRequestForm);
    await fill(wrapper, addDays(today, 5), addDays(today, 5));
    await wrapper.find('form').trigger('submit');

    expect(wrapper.text()).toContain('The end date must be after the start date.');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('blocks submission when the start date is in the past', async () => {
    const wrapper = mount(VacationRequestForm);
    await fill(wrapper, addDays(today, -1), addDays(today, 2));
    await wrapper.find('form').trigger('submit');

    expect(wrapper.text()).toContain('can’t start in the past');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('emits a clean payload and shows a live duration summary', async () => {
    const wrapper = mount(VacationRequestForm);
    await fill(wrapper, addDays(today, 10), addDays(today, 14), '  Beach  ');

    expect(wrapper.text()).toContain('5 days away');
    await wrapper.find('form').trigger('submit');
    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { startDate: addDays(today, 10), endDate: addDays(today, 14), reason: 'Beach' },
    ]);
  });

  it('lists the conflicting requests returned by the API', () => {
    const serverError = new ApiError(409, 'VACATION_OVERLAP', 'Overlap', [
      {
        message: 'x',
        requestId: 'r1',
        startDate: '2030-02-04',
        endDate: '2030-02-08',
        status: 'pending',
      },
    ]);
    const wrapper = mount(VacationRequestForm, { props: { serverError } });
    expect(wrapper.text()).toContain('These dates clash with another request');
    expect(wrapper.text()).toContain('Mon 4 Feb – Fri 8 Feb 2030 (pending)');
  });

  it('switches to resubmission wording when editing a rejected request', () => {
    const wrapper = mount(VacationRequestForm, {
      props: {
        request: {
          id: 'r1',
          startDate: addDays(today, 3),
          endDate: addDays(today, 4),
          days: 2,
          reason: null,
          status: 'rejected',
          comments: 'Busy',
          requester: { id: 'u1', name: 'A', email: 'a@example.com' },
          decidedBy: null,
          decidedAt: null,
          createdAt: '2030-01-01T00:00:00Z',
          updatedAt: '2030-01-01T00:00:00Z',
        },
      },
    });
    expect(wrapper.find('button[type="submit"]').text()).toBe('Resubmit request');
  });
});
