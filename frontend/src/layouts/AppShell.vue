<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import AppLogo from '@/components/AppLogo.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

const links = computed(() =>
  auth.role === 'validator'
    ? [
        { to: { name: 'review' }, label: 'Review requests' },
        { to: { name: 'team' }, label: 'Team planner' },
      ]
    : [
        { to: { name: 'my-requests' }, label: 'My requests' },
        { to: { name: 'team' }, label: 'Team planner' },
      ],
);

function signOut() {
  auth.logout();
  void router.push({ name: 'login' });
}
</script>

<template>
  <div class="min-h-dvh">
    <a
      href="#main"
      class="sr-only z-50 rounded-md bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
    >
      Skip to content
    </a>

    <header class="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <RouterLink :to="{ name: 'home' }" class="shrink-0" aria-label="Away home">
          <AppLogo />
        </RouterLink>

        <nav class="hidden h-full items-stretch gap-1 sm:flex" aria-label="Main">
          <RouterLink
            v-for="link in links"
            :key="link.label"
            :to="link.to"
            class="relative flex items-center px-3 font-semibold text-ink-soft transition-colors hover:text-ink"
            active-class="!text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t after:bg-lagoon-600"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div v-if="auth.user" class="ml-auto flex items-center gap-3">
          <div class="hidden text-right leading-tight md:block">
            <p class="text-sm font-semibold">{{ auth.user.name }}</p>
            <p class="text-xs text-ink-faint capitalize">{{ auth.user.role }}</p>
          </div>
          <UserAvatar :name="auth.user.name" />
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-ink/5 hover:text-ink"
            @click="signOut"
          >
            Sign out
          </button>
        </div>
      </div>

      <!-- Mobile navigation -->
      <nav class="flex gap-1 overflow-x-auto px-4 pb-2 sm:hidden" aria-label="Main">
        <RouterLink
          v-for="link in links"
          :key="link.label"
          :to="link.to"
          class="shrink-0 rounded-full px-3 py-1 text-sm font-semibold text-ink-soft"
          active-class="!bg-lagoon-600 !text-white"
        >
          {{ link.label }}
        </RouterLink>
      </nav>
    </header>

    <main id="main" class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <RouterView />
    </main>
  </div>
</template>
