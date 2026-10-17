import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { User } from '@/api/types';
import { useAuthStore } from '@/stores/auth';
import { installGuards, routes } from './index';

const makeRouter = () => {
  const router = createRouter({ history: createMemoryHistory(), routes });
  installGuards(router);
  return router;
};

const signInAs = (role: User['role']) => {
  useAuthStore().session = {
    token: 't',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: {
      id: 'u1',
      name: 'Test User',
      email: 't@example.com',
      role,
      createdAt: '2030-01-01T00:00:00Z',
    },
  };
};

describe('route guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('sends anonymous visitors to the login page, remembering where they were going', async () => {
    const router = makeRouter();
    await router.push('/review?status=pending');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.redirect).toBe('/review?status=pending');
  });

  it('routes each role to its own home page', async () => {
    signInAs('validator');
    const router = makeRouter();
    await router.push('/');
    expect(router.currentRoute.value.name).toBe('review');
  });

  it('keeps requesters out of validator pages (and vice versa)', async () => {
    signInAs('requester');
    const router = makeRouter();
    await router.push('/review');
    expect(router.currentRoute.value.name).toBe('my-requests');
  });

  it('lets both roles open the team planner', async () => {
    for (const role of ['requester', 'validator'] as const) {
      setActivePinia(createPinia());
      signInAs(role);
      const router = makeRouter();
      await router.push('/team');
      expect(router.currentRoute.value.name).toBe('team');
    }
  });

  it('redirects signed-in users away from the login page', async () => {
    signInAs('requester');
    const router = makeRouter();
    await router.push('/login');
    expect(router.currentRoute.value.name).toBe('my-requests');
  });

  it('treats an expired session as signed out', async () => {
    signInAs('requester');
    useAuthStore().session!.expiresAt = new Date(Date.now() - 1000).toISOString();
    const router = makeRouter();
    await router.push('/my-requests');
    expect(router.currentRoute.value.name).toBe('login');
  });
});
