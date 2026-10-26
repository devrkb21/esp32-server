package xiaozhi.modules.notify.push;

import java.util.Map;

/**
 * Hook for native app push (uni-push 2 / FCM). Not configured in this release: the default bean
 * ({@link NoopNativePushSender}) only logs. To turn native push on:
 * <ol>
 * <li>the app registers its push client id after login: {@code POST /notify/push/native
 * {provider: "unipush" | "fcm", token}} (manager-mobile utils/nativePush.ts, off by default);
 * the token is stored as an ai_push_subscription row with platform {@code native};</li>
 * <li>provide a Spring bean implementing this interface (marked {@code @Primary}) that sends
 * {@code payload} to the token through the provider (uni-push 2 cloud function or the FCM HTTP v1
 * API with a service account), and returns false for tokens the provider reports as invalid so
 * they are dropped.</li>
 * </ol>
 * Credentials belong in sys params (param_type 0, never sent to clients).
 */
public interface NativePushSender {

    /** Whether a real provider is configured; when false nothing is attempted. */
    boolean enabled();

    /**
     * Sends one notification. {@code payload} is the same map the web push carries: id, type,
     * title, body, titleBn, titleEn, bodyBn, bodyEn, deviceId, url. Returns false when the token
     * is no longer valid.
     */
    boolean send(String provider, String token, Map<String, Object> payload);
}
