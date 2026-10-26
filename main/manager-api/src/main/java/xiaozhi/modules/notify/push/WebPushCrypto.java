package xiaozhi.modules.notify.push;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPublicKeySpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Web Push with the JDK only: VAPID keys and JWT (RFC 8292, ES256) and message encryption
 * (RFC 8291, "aes128gcm" content coding of RFC 8188). Keys are P-256; public keys travel as the
 * 65-byte uncompressed point in base64url, the VAPID private key is stored as PKCS#8 base64url
 * and never leaves the server.
 */
public final class WebPushCrypto {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int RECORD_SIZE = 4096;

    private WebPushCrypto() {
    }

    // ------------------------------------------------------------------ keys

    public static KeyPair newKeyPair() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
            gen.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
            return gen.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("P-256 is not available", e);
        }
    }

    /** 0x04 || X || Y, 65 bytes. */
    public static byte[] rawPublic(PublicKey key) {
        ECPoint w = ((ECPublicKey) key).getW();
        byte[] out = new byte[65];
        out[0] = 4;
        copyUnsigned(w.getAffineX(), out, 1);
        copyUnsigned(w.getAffineY(), out, 33);
        return out;
    }

    public static PublicKey publicFromRaw(byte[] raw) throws GeneralSecurityException {
        if (raw == null || raw.length != 65 || raw[0] != 4) {
            throw new GeneralSecurityException("Not an uncompressed P-256 point");
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(raw, 1, 33));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(raw, 33, 65));
        ECParameterSpec params = ((ECPublicKey) newKeyPair().getPublic()).getParams();
        return KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(new ECPoint(x, y), params));
    }

    public static String privateToString(PrivateKey key) {
        return b64(key.getEncoded());
    }

    public static PrivateKey privateFromString(String text) throws GeneralSecurityException {
        return KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(unb64(text)));
    }

    // ------------------------------------------------------------------ VAPID

    /** The Authorization header value: {@code vapid t=<jwt>, k=<public key>}. */
    public static String vapidAuthorization(String endpoint, String subject, String publicKeyB64,
            PrivateKey privateKey, long nowSeconds) throws GeneralSecurityException {
        java.net.URI uri = java.net.URI.create(endpoint);
        String aud = uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
        String header = b64("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
        String claims = b64(("{\"aud\":\"" + aud + "\",\"exp\":" + (nowSeconds + 12 * 3600)
                + ",\"sub\":\"" + subject.replace("\"", "") + "\"}").getBytes(StandardCharsets.UTF_8));
        String signingInput = header + "." + claims;
        Signature sig = Signature.getInstance("SHA256withECDSA");
        sig.initSign(privateKey);
        sig.update(signingInput.getBytes(StandardCharsets.US_ASCII));
        String jwt = signingInput + "." + b64(derToRaw(sig.sign()));
        return "vapid t=" + jwt + ", k=" + publicKeyB64;
    }

    /** DER ECDSA signature to the 64-byte R || S form JWS uses. */
    static byte[] derToRaw(byte[] der) {
        int offset = 2;
        if ((der[1] & 0xff) > 0x80) {
            offset += (der[1] & 0x7f);
        }
        int rLen = der[offset + 1];
        byte[] r = Arrays.copyOfRange(der, offset + 2, offset + 2 + rLen);
        offset = offset + 2 + rLen;
        int sLen = der[offset + 1];
        byte[] s = Arrays.copyOfRange(der, offset + 2, offset + 2 + sLen);
        byte[] out = new byte[64];
        copyUnsigned(new BigInteger(1, r), out, 0);
        copyUnsigned(new BigInteger(1, s), out, 32);
        return out;
    }

    // ------------------------------------------------------------------ encryption

    /**
     * Encrypts a payload for one subscription (RFC 8291). {@code p256dh} and {@code auth} are
     * the subscription keys (base64url). Returns the request body (header + one record).
     */
    public static byte[] encrypt(byte[] payload, String p256dh, String auth) throws GeneralSecurityException {
        return encrypt(payload, unb64(p256dh), unb64(auth), newKeyPair(), randomBytes(16));
    }

    static byte[] encrypt(byte[] payload, byte[] uaPublic, byte[] authSecret, KeyPair server, byte[] salt)
            throws GeneralSecurityException {
        if (payload.length > RECORD_SIZE - 17 - 86) {
            throw new GeneralSecurityException("Payload too large for one record");
        }
        byte[] asPublic = rawPublic(server.getPublic());
        byte[] ecdh = ecdh(server.getPrivate(), publicFromRaw(uaPublic));
        byte[] prkKey = hmac(authSecret, ecdh);
        byte[] keyInfo = concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[] { 0 }, uaPublic, asPublic);
        byte[] ikm = Arrays.copyOf(hmac(prkKey, concat(keyInfo, new byte[] { 1 })), 32);
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, concat("Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII),
                new byte[] { 0, 1 })), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, concat("Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII),
                new byte[] { 0, 1 })), 12);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] encrypted = cipher.doFinal(concat(payload, new byte[] { 2 }));
        ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length);
        header.put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic);
        return concat(header.array(), encrypted);
    }

    /** The receiving side (a browser), for tests: decrypts a body made by {@link #encrypt}. */
    static byte[] decrypt(byte[] body, KeyPair ua, byte[] authSecret) throws GeneralSecurityException {
        byte[] salt = Arrays.copyOfRange(body, 0, 16);
        int idLen = body[20] & 0xff;
        byte[] asPublic = Arrays.copyOfRange(body, 21, 21 + idLen);
        byte[] cipherText = Arrays.copyOfRange(body, 21 + idLen, body.length);
        byte[] uaPublic = rawPublic(ua.getPublic());
        byte[] ecdh = ecdh(ua.getPrivate(), publicFromRaw(asPublic));
        byte[] prkKey = hmac(authSecret, ecdh);
        byte[] keyInfo = concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[] { 0 }, uaPublic, asPublic);
        byte[] ikm = Arrays.copyOf(hmac(prkKey, concat(keyInfo, new byte[] { 1 })), 32);
        byte[] prk = hmac(salt, ikm);
        byte[] cek = Arrays.copyOf(hmac(prk, concat("Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII),
                new byte[] { 0, 1 })), 16);
        byte[] nonce = Arrays.copyOf(hmac(prk, concat("Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII),
                new byte[] { 0, 1 })), 12);
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] plain = cipher.doFinal(cipherText);
        int end = plain.length - 1;
        while (end >= 0 && plain[end] == 0) {
            end--;
        }
        if (end < 0 || plain[end] != 2) {
            throw new GeneralSecurityException("Bad padding delimiter");
        }
        return Arrays.copyOf(plain, end);
    }

    // ------------------------------------------------------------------ helpers

    static byte[] ecdh(PrivateKey priv, PublicKey pub) throws GeneralSecurityException {
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(priv);
        ka.doPhase(pub, true);
        return ka.generateSecret();
    }

    static byte[] hmac(byte[] key, byte[] data) throws GeneralSecurityException {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data);
    }

    static byte[] randomBytes(int n) {
        byte[] b = new byte[n];
        RANDOM.nextBytes(b);
        return b;
    }

    static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] p : parts) {
            out.write(p, 0, p.length);
        }
        return out.toByteArray();
    }

    private static void copyUnsigned(BigInteger v, byte[] out, int at) {
        byte[] b = v.toByteArray();
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, out, at + 32 - len, len);
    }

    public static String b64(byte[] b) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public static byte[] unb64(String s) {
        String t = s.trim().replace('+', '-').replace('/', '_').replace("=", "");
        return Base64.getUrlDecoder().decode(t);
    }
}
