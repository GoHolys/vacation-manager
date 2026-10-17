import './assets/main.css';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { setUnauthorizedHandler } from '@/api/http';
import App from './App.vue';
import { createAppRouter } from './router';
import { useAuthStore } from './stores/auth';
import { useToastStore } from './stores/toasts';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);

const auth = useAuthStore();
auth.restore();

const router = createAppRouter();
app.use(router);

// Expired or revoked session: sign out once and send the user back to the login page.
setUnauthorizedHandler(() => {
  if (!auth.isAuthenticated && !auth.session) return;
  auth.logout();
  useToastStore().info('Your session has ended', 'Sign in again to continue.');
  const current = router.currentRoute.value;
  void router.replace({ name: 'login', query: { redirect: current.fullPath } });
});

app.mount('#app');
