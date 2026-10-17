import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PaginationBar from './PaginationBar.vue';
import StatusBadge from './StatusBadge.vue';

describe('StatusBadge', () => {
  it.each([
    ['pending', 'Pending'],
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
  ] as const)('renders %s with a text label and an icon', (status, label) => {
    const wrapper = mount(StatusBadge, { props: { status } });
    expect(wrapper.text()).toBe(label);
    expect(wrapper.find('svg').exists()).toBe(true);
  });
});

describe('PaginationBar', () => {
  const meta = (page: number, totalPages: number) => ({
    page,
    pageSize: 10,
    totalItems: totalPages * 10,
    totalPages,
  });

  it('shows the visible range and compacts long page lists', () => {
    const wrapper = mount(PaginationBar, { props: { meta: meta(6, 12) } });
    expect(wrapper.text()).toContain('51–60');
    const pages = wrapper.findAll('button[aria-label^="Page"]').map((b) => b.text());
    expect(pages).toEqual(['1', '5', '6', '7', '12']);
    expect(wrapper.find('[aria-current="page"]').text()).toBe('6');
  });

  it('emits page changes and disables out-of-range navigation', async () => {
    const wrapper = mount(PaginationBar, { props: { meta: meta(1, 3) } });
    expect(wrapper.find('button[aria-label="Previous page"]').attributes('disabled')).toBeDefined();
    await wrapper.find('button[aria-label="Next page"]').trigger('click');
    expect(wrapper.emitted('page')?.[0]).toEqual([2]);
  });

  it('renders nothing for an empty result', () => {
    const wrapper = mount(PaginationBar, {
      props: { meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } },
    });
    expect(wrapper.find('nav').exists()).toBe(false);
  });
});
