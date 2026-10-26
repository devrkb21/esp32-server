package xiaozhi.modules.notify.push;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.PrivateKey;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import cn.hutool.crypto.SecureUtil;
import org.apache.commons.lang3.StringUtils;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.notify.dao.PushSubscriptionDao;
import xiaozhi.modules.notify.entity.PushSubscriptionEntity;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * Web push (VAPID) and the native push hook. The VAPID key pair is made at the first start when
 * the sys params are missing: {@value #PARAM_PUBLIC} (sent to apps) and {@value #PARAM_PRIVATE}
 * (param_type 0: hidden from the params page and from the xiaozhi-server config; it never leaves
 * the server).
 */
@Slf4j
@Service
public class PushService {
    public static final String PARAM_PUBLIC = "push.vapid_public_key";
    public static final String PARAM_PRIVATE = "push.vapid_private_key";
    public static final String PARAM_SUBJECT = "push.vapid_subject";
    static final String DEFAULT_SUBJECT = "mailto:admin@localhost";

    /**
     * Push services browsers use. The server only posts to these hosts, so a subscription can
     * not make it call an arbitrary address.
     */
    static final List<String> PUSH_HOSTS = List.of("fcm.googleapis.com", "android.googleapis.com",
            "updates.push.services.mozilla.com", "push.services.mozilla.com", "notify.windows.com",
            "push.apple.com");

    private static final int MAX_FAILS = 5;

    private final SysParamsService sysParamsService;
    private final PushSubscriptionDao subscriptionDao;
    private final RestTemplate restTemplate;
    private final NativePushSender nativePushSender;
    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "web-push");
        t.setDaemon(true);
        return t;
    });

    private volatile PrivateKey privateKey;
    private volatile String publicKey;

    public PushService(SysParamsService sysParamsService, PushSubscriptionDao subscriptionDao,
            RestTemplate restTemplate, NativePushSender nativePushSender) {
        this.sysParamsService = sysParamsService;
        this.subscriptionDao = subscriptionDao;
        this.restTemplate = restTemplate;
        this.nativePushSender = nativePushSender;
    }

    @PreDestroy
    void stop() {
        executor.shutdownNow();
    }

    /** Makes the VAPID keys at the first start (when the params are missing). */
    @EventListener(ApplicationReadyEvent.class)
    public void ensureKeys() {
        try {
            loadKeys();
        } catch (Exception e) {
            log.warn("Web push keys are not ready: {}", e.getMessage());
        }
    }

    private synchronized void loadKeys() throws Exception {
        if (privateKey != null && publicKey != null) {
            return;
        }
        String pub = sysParamsService.getValue(PARAM_PUBLIC, false);
        String priv = sysParamsService.getValue(PARAM_PRIVATE, false);
        if (isBlank(pub) || isBlank(priv)) {
            KeyPair pair = WebPushCrypto.newKeyPair();
            pub = WebPushCrypto.b64(WebPushCrypto.rawPublic(pair.getPublic()));
            priv = WebPushCrypto.privateToString(pair.getPrivate());
            sysParamsService.setParam(PARAM_PRIVATE, priv, "Web push VAPID private key (generated, never sent to clients)");
            sysParamsService.setParam(PARAM_PUBLIC, pub, "Web push VAPID public key (generated)");
            log.info("Web push: generated a VAPID key pair");
        }
        privateKey = WebPushCrypto.privateFromString(priv);
        publicKey = pub;
    }

    private static boolean isBlank(String v) {
        return StringUtils.isBlank(v) || "null".equalsIgnoreCase(v);
    }

    /** The VAPID public key (base64url, 65-byte point) for PushManager.subscribe. */
    public String publicKey() {
        if (publicKey == null) {
            try {
                loadKeys();
            } catch (Exception e) {
                throw new RenException("Web push is not ready on the server");
            }
        }
        return publicKey;
    }

    // ------------------------------------------------------------------ subscriptions

    public void subscribe(Long userId, String endpoint, String p256dh, String auth, String platform) {
        String plat = "h5".equals(platform) ? "h5" : "web";
        checkEndpoint(endpoint);
        try {
            if (WebPushCrypto.unb64(p256dh).length != 65 || WebPushCrypto.unb64(auth).length != 16) {
                throw new IllegalArgumentException("key length");
            }
        } catch (RuntimeException e) {
            throw new RenException("This browser subscription is not valid");
        }
        save(userId, plat, endpoint, p256dh, auth);
    }

    public void registerNative(Long userId, String provider, String token) {
        String prov = "fcm".equals(provider) ? "fcm" : "unipush";
        if (StringUtils.isBlank(token) || token.length() > 1000) {
            throw new RenException("The push token is not valid");
        }
        save(userId, "native", token.trim(), prov, null);
    }

    private void save(Long userId, String platform, String endpoint, String p256dh, String auth) {
        String hash = SecureUtil.sha1(endpoint);
        PushSubscriptionEntity row = subscriptionDao.selectOne(new QueryWrapper<PushSubscriptionEntity>()
                .eq("endpoint_hash", hash).last("LIMIT 1"));
        boolean fresh = row == null;
        if (fresh) {
            row = new PushSubscriptionEntity();
            row.setCreateDate(new Date());
        }
        row.setUserId(userId);
        row.setPlatform(platform);
        row.setEndpoint(endpoint);
        row.setEndpointHash(hash);
        row.setP256dh(p256dh);
        row.setAuth(auth);
        row.setFailCount(0);
        if (fresh) {
            subscriptionDao.insert(row);
        } else {
            subscriptionDao.updateById(row);
        }
    }

    public void unsubscribe(Long userId, String endpoint) {
        if (StringUtils.isBlank(endpoint)) {
            return;
        }
        subscriptionDao.delete(new QueryWrapper<PushSubscriptionEntity>()
                .eq("user_id", userId).eq("endpoint_hash", SecureUtil.sha1(endpoint)));
    }

    public long countWeb(Long userId) {
        Long n = subscriptionDao.selectCount(new QueryWrapper<PushSubscriptionEntity>()
                .eq("user_id", userId).in("platform", "web", "h5"));
        return n == null ? 0 : n;
    }

    /** Only https endpoints of the browsers' push services. */
    static void checkEndpoint(String endpoint) {
        URI uri;
        try {
            uri = URI.create(endpoint == null ? "" : endpoint.trim());
        } catch (IllegalArgumentException e) {
            throw new RenException("This browser subscription is not valid");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !allowedHost(host)) {
            throw new RenException("This browser's push service is not supported");
        }
    }

    static boolean allowedHost(String host) {
        for (String h : PUSH_HOSTS) {
            if (host.equals(h) || host.endsWith("." + h)) {
                return true;
            }
        }
        return false;
    }

    // ------------------------------------------------------------------ sending

    /** Pushes to every subscription of the user in the background. */
    public void sendToUser(Long userId, Map<String, Object> payload) {
        List<PushSubscriptionEntity> subs = subscriptionDao.selectList(new QueryWrapper<PushSubscriptionEntity>()
                .eq("user_id", userId));
        if (subs.isEmpty()) {
            return;
        }
        for (PushSubscriptionEntity sub : subs) {
            executor.execute(() -> deliver(sub, payload));
        }
    }

    private void deliver(PushSubscriptionEntity sub, Map<String, Object> payload) {
        try {
            boolean ok;
            if ("native".equals(sub.getPlatform())) {
                if (!nativePushSender.enabled()) {
                    return;
                }
                ok = nativePushSender.send(sub.getP256dh(), sub.getEndpoint(), payload);
                if (!ok) {
                    subscriptionDao.deleteById(sub.getId());
                }
                return;
            }
            ok = sendWeb(sub, JsonUtils.toJsonString(payload).getBytes(StandardCharsets.UTF_8));
            if (ok) {
                PushSubscriptionEntity upd = new PushSubscriptionEntity();
                upd.setId(sub.getId());
                upd.setLastOk(new Date());
                upd.setFailCount(0);
                subscriptionDao.updateById(upd);
            }
        } catch (Exception e) {
            log.debug("Push to subscription {} failed: {}", sub.getId(), e.getMessage());
        }
    }

    /** One web push. False when it failed; a gone subscription (404/410) is deleted. */
    boolean sendWeb(PushSubscriptionEntity sub, byte[] json) {
        try {
            checkEndpoint(sub.getEndpoint());
            byte[] body = WebPushCrypto.encrypt(json, sub.getP256dh(), sub.getAuth());
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.set("Content-Encoding", "aes128gcm");
            headers.set("TTL", "86400");
            headers.set("Urgency", "high");
            String subject = sysParamsService.getValue(PARAM_SUBJECT, true);
            headers.set("Authorization", WebPushCrypto.vapidAuthorization(sub.getEndpoint(),
                    isBlank(subject) ? DEFAULT_SUBJECT : subject, publicKey(), privateKey,
                    System.currentTimeMillis() / 1000));
            restTemplate.exchange(URI.create(sub.getEndpoint()), HttpMethod.POST, new HttpEntity<>(body, headers),
                    String.class);
            return true;
        } catch (HttpStatusCodeException e) {
            int code = e.getStatusCode().value();
            if (code == 404 || code == 410) {
                subscriptionDao.deleteById(sub.getId());
            } else {
                noteFailure(sub);
                log.info("Web push answered {}: {}", code, StringUtils.abbreviate(e.getResponseBodyAsString(), 200));
            }
            return false;
        } catch (Exception e) {
            noteFailure(sub);
            log.info("Web push failed: {}", e.getMessage());
            return false;
        }
    }

    private void noteFailure(PushSubscriptionEntity sub) {
        int fails = (sub.getFailCount() == null ? 0 : sub.getFailCount()) + 1;
        if (fails >= MAX_FAILS) {
            subscriptionDao.deleteById(sub.getId());
            return;
        }
        PushSubscriptionEntity upd = new PushSubscriptionEntity();
        upd.setId(sub.getId());
        upd.setFailCount(fails);
        subscriptionDao.updateById(upd);
    }
}
