import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/api/endpoints';
import { useAuthStore } from './auth';

const session = (expiresInMs: number) => ({
  accessToken: 'jwt-token',
  tokenType: 'Bearer' as const,
  expiresIn: 3600,
  expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  user: {
    id: 'u1',
    name: 'Liam Carter',
    email: 'requester@example.com',
    role: 'requester' as const,
    createdAt: '',
  },
});

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('logs in, persists the session and exposes the role', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(session(3_600_000));
    const auth = useAuthStore();

    await auth.login('requester@example.com', 'secret');

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.role).toBe('requester');
    expect(auth.homeRouteName).toBe('my-requests');
    expect(JSON.parse(localStorage.getItem('away.session')!)).toMatchObject({ token: 'jwt-token' });
  });

  it('logs out and clears storage', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(session(3_600_000));
    const auth = useAuthStore();
    await auth.login('requester@example.com', 'secret');

    auth.logout();

    expect(auth.isAuthenticated).toBe(false);
    expect(localStorage.getItem('away.session')).toBeNull();
  });

  it('restores a valid session but discards an expired one', () => {
    const valid = session(3_600_000);
    localStorage.setItem(
      'away.session',
      JSON.stringify({ token: 'a', expiresAt: valid.expiresAt, user: valid.user }),
    );
    const auth = useAuthStore();
    auth.restore();
    expect(auth.isAuthenticated).toBe(true);

    setActivePinia(createPinia());
    const expired = session(-1000);
    localStorage.setItem(
      'away.session',
      JSON.stringify({ token: 'b', expiresAt: expired.expiresAt, user: expired.user }),
    );
    const fresh = useAuthStore();
    fresh.restore();
    expect(fresh.isAuthenticated).toBe(false);
    expect(localStorage.getItem('away.session')).toBeNull();
  });
});
