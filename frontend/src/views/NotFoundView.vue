<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
</script>

<template>
  <div class="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
    <p class="font-display text-7xl font-bold text-lagoon-200">404</p>
    <h1 class="mt-2 text-2xl font-bold">This page doesn’t exist</h1>
    <p class="mt-2 text-ink-soft">The link may be broken, or the page may have moved.</p>
    <RouterLink
      :to="{ name: auth.isAuthenticated ? auth.homeRouteName : 'login' }"
      class="mt-6 rounded-lg bg-lagoon-600 px-4 py-2 font-semibold text-white hover:bg-lagoon-700"
    >
      {{ auth.isAuthenticated ? 'Go to your dashboard' : 'Go to sign in' }}
    </RouterLink>
  </div>
</template>
