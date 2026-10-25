// Composables shared by the sign-in pages: the picture code, the SMS countdown, the public config.
import { computed, onBeforeUnmount, ref } from 'vue';
import { useStore } from 'vuex';
import Api from '@/apis/api';
import { getUUID } from '@/utils';
import { areaOptions, defaultAreaCode } from './authKit';

// The picture code (captcha): a fresh uuid per fetch, the image as an object URL.
// state: loading | ready | failed. The server never answers a failed fetch, so a fetch that has
// not come back after 15 s counts as failed and the button offers another try.
export function useCaptcha() {
  const id = ref('');
  const url = ref('');
  const state = ref('loading');
  let watchdog = null;

  function revoke() {
    if (url.value) { try { URL.revokeObjectURL(url.value); } catch (e) { /* already gone */ } }
  }
  function refresh() {
    const mine = getUUID();
    id.value = mine;
    state.value = 'loading';
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { if (id.value === mine && state.value === 'loading') state.value = 'failed'; }, 15000);
    Api.user.getCaptcha(mine, (res) => {
      if (mine !== id.value) return; // an older fetch came back late
      clearTimeout(watchdog);
      if (res && res.status === 200 && res.data) {
        const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: res.data.type });
        revoke();
        url.value = URL.createObjectURL(blob);
        state.value = 'ready';
      } else {
        state.value = 'failed';
      }
    });
  }
  onBeforeUnmount(() => { clearTimeout(watchdog); revoke(); });
  return { id, url, state, refresh };
}

// The "send code again in n seconds" countdown after an SMS code is requested.
export function useCountdown(seconds = 60) {
  const left = ref(0);
  let timer = null;
  function stop() { clearInterval(timer); timer = null; left.value = 0; }
  function start() {
    clearInterval(timer);
    left.value = seconds;
    timer = setInterval(() => {
      if (left.value > 1) left.value -= 1;
      else stop();
    }, 1000);
  }
  onBeforeUnmount(() => clearInterval(timer));
  return { left, start, stop };
}

// The public config (/user/pub-config) through the store, as the old pages read it.
export function usePubConfig() {
  const store = useStore();
  const cfg = computed(() => store.state.pubConfig || {});
  const allowRegister = computed(() => Boolean(cfg.value.allowUserRegister));
  const mobileEnabled = computed(() => Boolean(cfg.value.enableMobileRegister));
  const publicKey = computed(() => cfg.value.sm2PublicKey || '');
  const areas = computed(() => areaOptions(cfg.value.mobileAreaList));
  const firstArea = () => defaultAreaCode(cfg.value.mobileAreaList);
  const load = () => store.dispatch('fetchPubConfig');
  return { store, cfg, allowRegister, mobileEnabled, publicKey, areas, firstArea, load };
}

// A submit that never hears back (the request layer retries on network failure, then gives up
// silently) must not leave the button spinning forever.
export function useBusy(limitMs = 35000) {
  const busy = ref(false);
  let t = null;
  function on() { busy.value = true; clearTimeout(t); t = setTimeout(() => { busy.value = false; }, limitMs); }
  function off() { busy.value = false; clearTimeout(t); }
  onBeforeUnmount(() => clearTimeout(t));
  return { busy, on, off };
}
