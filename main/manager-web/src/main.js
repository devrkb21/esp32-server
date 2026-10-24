import { createApp } from 'vue';
import './styles/tb/fonts.js';
import './styles/tb/tokens.css';
import './styles/tb/base.css';
import App from './App.vue';
import router from './router';
import store from './store';
import i18n from './i18n';
import kit from './kit';
import { initTheme } from './utils/theme';
import { DEMO, DEMO_TOKEN, DEMO_USER } from './apis/demo/index';

initTheme();

// Demo build: signed in as a sample owner, every API call answered from fixtures.
if (DEMO) {
  try {
    if (!localStorage.getItem('token')) localStorage.setItem('token', DEMO_TOKEN);
    localStorage.setItem('userInfo', JSON.stringify(DEMO_USER));
  } catch (e) { /* private mode */ }
}

// Copy the token into the store before the first request, so it carries the Authorization header.
try {
  const cachedToken = localStorage.getItem('token');
  if (cachedToken) store.commit('setToken', cachedToken);
} catch (e) { /* private mode */ }

const app = createApp(App);
app.use(router);
app.use(store);
app.use(i18n);
app.use(kit);
app.mount('#app');
