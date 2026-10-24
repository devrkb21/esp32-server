import './styles/element-variables.scss';
import 'normalize.css/normalize.css'; // A modern alternative to CSS resets
import Vue from 'vue';
import ElementUI from 'element-ui';
import App from './App.vue';
import router from './router';
import store from './store';
import i18n from './i18n';
import locale from 'element-ui/lib/locale'
import './styles/nobix/index.scss';
import './styles/global.scss';
import { register as registerServiceWorker } from './registerServiceWorker';
import featureManager from './utils/featureManager';
import { initTheme } from './utils/theme';

// Initialize dark/light theme
initTheme();

// Create event bus for inter-component communication
Vue.prototype.$eventBus = new Vue();

Vue.use(ElementUI);
locale.i18n((key, value) => i18n.t(key, value))

Vue.config.productionTip = false
document.title = process.env.VUE_APP_TITLE || 'Nobix Console';

// Register Service Worker
registerServiceWorker();

// On startup, copy the token from localStorage into the store so the first request after the
// router guard lets us through carries the Authorization header (otherwise state.token is null,
// the request gets a 401 and the user is sent to the login page)
const cachedToken = localStorage.getItem('token')
if (cachedToken) {
  store.commit('setToken', cachedToken)
}

// Create Vue instance
new Vue({
  router,
  store,
  i18n,
  render: function (h) { return h(App) }
}).$mount('#app')
