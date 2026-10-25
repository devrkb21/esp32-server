import { computed, onBeforeUnmount, ref } from 'vue'
import { DEMO } from '@/api/demo'
import { demoCaptchaSrc } from '@/api/demo/pages/m-auth'
import { useConfigStore } from '@/store'
import { getEnvBaseUrl } from '@/utils'
import { areaList, defaultAreaCode, uuid } from './authKit.mjs'

// Shared state of the account screens: the picture code, the SMS countdown, the public config.

/** The picture code: a fresh id per fetch; the server draws the image at /user/captcha. */
export function useCaptcha() {
  const id = ref('')
  const src = ref('')
  function refresh() {
    const next = uuid()
    id.value = next
    src.value = DEMO ? demoCaptchaSrc(next) : `${getEnvBaseUrl()}/user/captcha?uuid=${next}&t=${Date.now()}`
  }
  return { id, src, refresh }
}

/** "Send again in n seconds" after an SMS code was asked for (60 s, as before). */
export function useCountdown(seconds = 60) {
  const left = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null
  function stop() {
    if (timer)
      clearInterval(timer)
    timer = null
    left.value = 0
  }
  function start() {
    stop()
    left.value = seconds
    timer = setInterval(() => {
      left.value--
      if (left.value <= 0)
        stop()
    }, 1000)
  }
  onBeforeUnmount(stop)
  return { left, start, stop }
}

/** The public config (/user/pub-config) through the config store, fetched when missing. */
export function usePubConfig() {
  const configStore = useConfigStore()
  const cfg = computed(() => configStore.config || ({} as any))
  const mobileEnabled = computed(() => Boolean(cfg.value.enableMobileRegister))
  const publicKey = computed(() => cfg.value.sm2PublicKey || '')
  const areas = computed(() => areaList(cfg.value.mobileAreaList) as { name: string, key: string }[])
  const firstArea = () => defaultAreaCode(cfg.value.mobileAreaList) as string
  async function load() {
    if (configStore.config.name && configStore.config.sm2PublicKey)
      return
    try {
      await configStore.fetchPublicConfig()
    }
    catch (error) {
      console.error('Failed to get configuration:', error)
    }
  }
  return { configStore, cfg, mobileEnabled, publicKey, areas, firstArea, load }
}
