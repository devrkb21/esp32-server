import { registerNativePush } from '@/api/notify/notify'

/**
 * Native push for the app build (uni-push 2.0 / FCM). NOT ENABLED: no push module is configured in
 * the manifest and the server's native sender is a documented no-op until it is set up.
 *
 * To turn it on later:
 *   1. In manifest.config.ts enable the uni-push module (app-plus.modules.Push and
 *      app-plus.distribute.sdkConfigs.push.unipush, or the FCM/Google service config for Android)
 *      and set up the uni-push 2.0 service on DCloud (or a Firebase project for FCM).
 *   2. Call `startNativePush()` once after sign-in (for example in App.vue onLaunch when a token
 *      exists). It reads the push client id and sends it with POST /notify/push/native
 *      { provider, token }; manager-api stores it next to the web push subscriptions.
 *   3. Configure the server's native sender (manager-api notify module, NativePushSender) with
 *      the provider's credentials; until then it stores tokens and sends nothing.
 *   4. Notification taps: listen with uni.onPushMessage (type 'click') and open the page the
 *      payload names (`url`, normally /pages/notifications/index).
 */
export const NATIVE_PUSH_ENABLED = false

export function startNativePush(provider: 'unipush' | 'fcm' = 'unipush'): Promise<boolean> {
  // #ifdef APP-PLUS
  if (!NATIVE_PUSH_ENABLED)
    return Promise.resolve(false)
  return new Promise((resolve) => {
    uni.getPushClientId({
      success: async (res: any) => {
        try {
          await registerNativePush(provider, String(res?.cid || ''))
          resolve(true)
        }
        catch {
          resolve(false)
        }
      },
      fail: () => resolve(false),
    })
  })
  // #endif
  // #ifndef APP-PLUS
  return Promise.resolve(false)
  // #endif
}
