package xiaozhi.modules.notify.push;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.PrivateKey;
import java.security.Signature;
import java.util.Base64;

import org.junit.jupiter.api.Test;

import xiaozhi.common.exception.RenException;

/** Lives in the push package to reach the package-private test helpers. */
class WebPushCryptoTest {

    @Test
    void aBrowserCanDecryptWhatTheServerEncrypts() throws Exception {
        KeyPair browser = WebPushCrypto.newKeyPair();
        byte[] auth = WebPushCrypto.randomBytes(16);
        String p256dh = WebPushCrypto.b64(WebPushCrypto.rawPublic(browser.getPublic()));
        byte[] payload = "{\"title\":\"রোবট অফলাইন\"}".getBytes(StandardCharsets.UTF_8);

        byte[] body = WebPushCrypto.encrypt(payload, p256dh, WebPushCrypto.b64(auth));

        // RFC 8188 header: salt(16) | record size 4096 | key id length 65 | server key
        assertEquals(4096, ((body[16] & 0xff) << 24) | ((body[17] & 0xff) << 16) | ((body[18] & 0xff) << 8) | (body[19] & 0xff));
        assertEquals(65, body[20] & 0xff);
        assertEquals(4, body[21]);
        assertArrayEquals(payload, WebPushCrypto.decrypt(body, browser, auth));
    }

    @Test
    void keysSurviveTheirTextForms() throws Exception {
        KeyPair pair = WebPushCrypto.newKeyPair();
        byte[] raw = WebPushCrypto.rawPublic(pair.getPublic());
        assertEquals(65, raw.length);
        assertArrayEquals(raw, WebPushCrypto.rawPublic(WebPushCrypto.publicFromRaw(raw)));
        PrivateKey back = WebPushCrypto.privateFromString(WebPushCrypto.privateToString(pair.getPrivate()));
        assertArrayEquals(pair.getPrivate().getEncoded(), back.getEncoded());
        assertThrows(Exception.class, () -> WebPushCrypto.publicFromRaw(new byte[10]));
    }

    @Test
    void vapidJwtIsSignedWithTheServerKey() throws Exception {
        KeyPair pair = WebPushCrypto.newKeyPair();
        String pub = WebPushCrypto.b64(WebPushCrypto.rawPublic(pair.getPublic()));
        String header = WebPushCrypto.vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", "mailto:a@b.c",
                pub, pair.getPrivate(), 1_800_000_000L);

        assertTrue(header.startsWith("vapid t="));
        assertTrue(header.endsWith(", k=" + pub));
        String jwt = header.substring("vapid t=".length(), header.indexOf(", k="));
        String[] parts = jwt.split("\\.");
        assertEquals(3, parts.length);
        String claims = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        assertTrue(claims.contains("\"aud\":\"https://fcm.googleapis.com\""));
        assertTrue(claims.contains("\"exp\":1800043200"));
        byte[] raw = Base64.getUrlDecoder().decode(parts[2]);
        assertEquals(64, raw.length);
        Signature verify = Signature.getInstance("SHA256withECDSAinP1363Format");
        verify.initVerify(pair.getPublic());
        verify.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertTrue(verify.verify(raw));
    }

    @Test
    void onlyBrowserPushServicesAreCalled() {
        PushService.checkEndpoint("https://fcm.googleapis.com/fcm/send/x");
        PushService.checkEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x");
        PushService.checkEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x");
        PushService.checkEndpoint("https://web.push.apple.com/x");
        assertThrows(RenException.class, () -> PushService.checkEndpoint("http://fcm.googleapis.com/x"));
        assertThrows(RenException.class, () -> PushService.checkEndpoint("https://192.168.0.1/x"));
        assertThrows(RenException.class, () -> PushService.checkEndpoint("https://evilfcm.googleapis.com.example.com/x"));
        assertThrows(RenException.class, () -> PushService.checkEndpoint(null));
        assertFalse(PushService.allowedHost("notgoogleapis.com"));
    }
}
