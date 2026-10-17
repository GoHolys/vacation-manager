import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { authApi } from '@/api/endpoints';
import { setAccessToken } from '@/api/http';
import type { AuthSession, User, UserRole } from '@/api/types';
import { safeStorage } from '@/utils/storage';

const STORAGE_KEY = 'away.session';

interface StoredSession {
  token: string;
  expiresAt: string;
  user: User;
}

export const HOME_ROUTE: Record<UserRole, string> = {
  requester: 'my-requests',
  validator: 'review',
};

export const useAuthStore = defineStore('auth', () => {
  const session = ref<StoredSession | null>(null);
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;

  const user = computed(() => session.value?.user ?? null);
  const role = computed(() => user.value?.role ?? null);
  const isAuthenticated = computed(
    () => !!session.value && new Date(session.value.expiresAt).getTime() > Date.now(),
  );
  const homeRouteName = computed(() => (role.value ? HOME_ROUTE[role.value] : 'login'));

  function apply(next: StoredSession | null): void {
    session.value = next;
    setAccessToken(next?.token ?? null);
    clearTimeout(expiryTimer);
    if (next) {
      safeStorage.set(STORAGE_KEY, next);
      // Sign out exactly when the token expires instead of waiting for a failing request.
      const msLeft = new Date(next.expiresAt).getTime() - Date.now();
      expiryTimer = setTimeout(() => logout(), Math.min(Math.max(msLeft, 0), 2 ** 31 - 1));
    } else {
      safeStorage.remove(STORAGE_KEY);
    }
  }

  /** Restores a saved, still-valid session (called once at start-up). */
  function restore(): void {
    const stored = safeStorage.get<StoredSession>(STORAGE_KEY);
    if (stored?.token && new Date(stored.expiresAt).getTime() > Date.now()) apply(stored);
    else apply(null);
  }

  async function login(email: string, password: string): Promise<User> {
    const result: AuthSession = await authApi.login(email, password);
    apply({ token: result.accessToken, expiresAt: result.expiresAt, user: result.user });
    return result.user;
  }

  function logout(): void {
    apply(null);
  }

  /**
   * Re-reads the profile after a reload: roles can change server-side while a token is still valid.
   * A revoked session answers 401, which the HTTP interceptor turns into a sign-out.
   */
  async function refreshProfile(): Promise<void> {
    if (!session.value) return;
    const fresh = await authApi.me();
    if (session.value) apply({ ...session.value, user: fresh });
  }

  return {
    session,
    user,
    role,
    isAuthenticated,
    homeRouteName,
    restore,
    login,
    logout,
    refreshProfile,
  };
});
