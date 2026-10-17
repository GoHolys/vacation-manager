import { createRouter, createWebHistory, type RouteRecordRaw, type Router } from 'vue-router';
import type { UserRole } from '@/api/types';
import { useAuthStore } from '@/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** Only reachable when signed out (e.g. the login page). */
    guestOnly?: boolean;
    /** Roles allowed on this route; implies authentication. */
    roles?: UserRole[];
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: 'Sign in', guestOnly: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppShell.vue'),
    meta: { roles: ['requester', 'validator'] },
    children: [
      {
        path: '',
        name: 'home',
        redirect: () => ({ name: useAuthStore().homeRouteName }),
      },
      {
        path: 'my-requests',
        name: 'my-requests',
        component: () => import('@/views/MyRequestsView.vue'),
        meta: { title: 'My requests', roles: ['requester'] },
      },
      {
        path: 'review',
        name: 'review',
        component: () => import('@/views/ReviewView.vue'),
        meta: { title: 'Review requests', roles: ['validator'] },
      },
      {
        path: 'team',
        name: 'team',
        component: () => import('@/views/TeamPlannerView.vue'),
        meta: { title: 'Team planner', roles: ['requester', 'validator'] },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: 'Page not found' },
  },
];

/**
 * Client-side guards mirror the API's RBAC for a smooth UX (no flashes of forbidden pages).
 * They are *not* the security boundary — the API enforces every rule independently.
 */
export function installGuards(router: Router): void {
  router.beforeEach((to) => {
    const auth = useAuthStore();
    // Nested routes inherit the most specific `roles` declaration.
    const roles = [...to.matched].reverse().find((record) => record.meta.roles)?.meta.roles;

    if (to.meta.guestOnly && auth.isAuthenticated) return { name: auth.homeRouteName };
    if (roles && !auth.isAuthenticated) {
      return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} };
    }
    if (roles && auth.role && !roles.includes(auth.role)) return { name: auth.homeRouteName };
    return true;
  });

  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} | Away` : 'Away';
  });
}

export function createAppRouter(): Router {
  const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  });
  installGuards(router);
  return router;
}
