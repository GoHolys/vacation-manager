<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { type ApiError, toApiError } from '@/api/http';
import AppLogo from '@/components/AppLogo.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import FormField from '@/components/ui/FormField.vue';
import { HOME_ROUTE, useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = reactive({ email: '', password: '' });
const showPassword = ref(false);
const submitting = ref(false);
const error = ref<ApiError | null>(null);

const DEMO_PASSWORD = 'Password123!';
const demoAccounts = [
  {
    name: 'Liam Carter',
    role: 'Requester',
    email: 'requester@example.com',
    hint: 'Submit and track requests',
  },
  {
    name: 'Olivia Bennett',
    role: 'Validator',
    email: 'validator@example.com',
    hint: 'Approve or reject requests',
  },
];

async function signIn() {
  error.value = null;
  submitting.value = true;
  try {
    const user = await auth.login(form.email, form.password);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null;
    // Only follow same-app redirects (prevents open-redirect abuse).
    await router.replace(
      redirect?.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : { name: HOME_ROUTE[user.role] },
    );
  } catch (caught) {
    error.value = toApiError(caught);
  } finally {
    submitting.value = false;
  }
}

function useDemo(email: string) {
  form.email = email;
  form.password = DEMO_PASSWORD;
  void signIn();
}

/** Decorative wall-planner preview for the brand panel. */
const preview = [
  { name: 'Emma', bars: [{ start: 2, span: 5, pending: false }] },
  { name: 'Noah', bars: [{ start: 9, span: 6, pending: false }] },
  {
    name: 'Yuki',
    bars: [
      { start: 1, span: 3, pending: true },
      { start: 12, span: 3, pending: false },
    ],
  },
  { name: 'Sofia', bars: [{ start: 6, span: 4, pending: true }] },
];
</script>

<template>
  <div class="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
    <!-- Brand panel -->
    <section
      class="relative hidden overflow-hidden bg-lagoon-800 p-12 text-white lg:flex lg:flex-col"
    >
      <AppLogo inverted />
      <div class="mt-auto max-w-lg">
        <h1 class="font-display text-[2.75rem] leading-[1.05] font-bold text-white">
          Time off, without the back-and-forth.
        </h1>
        <p class="mt-4 text-lg text-lagoon-100">
          Request days away, get a clear answer, and see the whole team’s plans on one calendar.
        </p>
      </div>

      <div class="mt-12 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10" aria-hidden="true">
        <div class="grid grid-cols-[4.5rem_repeat(15,1fr)] gap-y-2.5 text-sm">
          <template v-for="row in preview" :key="row.name">
            <span class="text-lagoon-100">{{ row.name }}</span>
            <div class="col-span-15 grid grid-cols-subgrid">
              <span
                v-for="bar in row.bars"
                :key="bar.start"
                class="h-5 rounded-full"
                :class="bar.pending ? 'login-pending' : 'bg-lagoon-200'"
                :style="{ gridColumn: `${bar.start} / span ${bar.span}` }"
              />
            </div>
          </template>
        </div>
        <div class="mt-4 flex items-center gap-2 text-sm text-lagoon-100">
          <span class="size-2.5 rounded-full bg-sun" /> 2 people away today
        </div>
      </div>
    </section>

    <!-- Sign-in -->
    <section class="flex items-center justify-center px-4 py-12 sm:px-8">
      <div class="w-full max-w-sm">
        <AppLogo class="mb-10 lg:hidden" />
        <h2 class="text-3xl font-bold">Sign in</h2>
        <p class="mt-1.5 text-ink-soft">Use your work account to continue.</p>

        <form class="mt-8 space-y-4" novalidate @submit.prevent="signIn">
          <FormField v-slot="attrs" label="Email">
            <input
              v-bind="attrs"
              v-model.trim="form.email"
              type="email"
              autocomplete="username"
              class="control"
              required
            />
          </FormField>
          <FormField v-slot="attrs" label="Password">
            <div class="relative">
              <input
                v-bind="attrs"
                v-model="form.password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                class="control pr-16"
                required
              />
              <button
                type="button"
                class="absolute inset-y-1 right-1 rounded-md px-2.5 text-sm font-semibold text-ink-soft hover:bg-ink/5"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                {{ showPassword ? 'Hide' : 'Show' }}
              </button>
            </div>
          </FormField>

          <p
            v-if="error"
            class="rounded-lg bg-rejected-bg px-3 py-2.5 text-sm text-rejected"
            role="alert"
          >
            {{
              error.code === 'VALIDATION_ERROR'
                ? 'Enter a valid email and your password.'
                : error.message
            }}
          </p>

          <BaseButton type="submit" variant="primary" block :loading="submitting"
            >Sign in</BaseButton
          >
        </form>

        <div class="mt-10 border-t border-line pt-6">
          <p class="text-sm font-semibold">Try a demo account</p>
          <div class="mt-3 grid gap-2">
            <button
              v-for="account in demoAccounts"
              :key="account.email"
              type="button"
              class="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-lagoon-500 hover:bg-lagoon-50/50 disabled:opacity-60"
              :disabled="submitting"
              @click="useDemo(account.email)"
            >
              <span>
                <span class="block font-semibold">{{ account.name }}</span>
                <span class="block text-sm text-ink-faint">{{ account.hint }}</span>
              </span>
              <span
                class="rounded-full bg-lagoon-50 px-2.5 py-0.5 text-xs font-semibold text-lagoon-700"
              >
                {{ account.role }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-pending {
  background: repeating-linear-gradient(135deg, rgb(255 255 255 / 0.35) 0 4px, transparent 4px 8px);
  box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.55);
}
</style>
