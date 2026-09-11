package xiaozhi.common.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

public class AESUtilsTest {

    @Test
    public void testEncryptAndDecrypt() {
        String key = "xiaozhi1234567890";
        String plainText = "Hello, Xiaozhi!";

        System.out.println("Original text: " + plainText);
        System.out.println("Key: " + key);

        // Encrypt
        String encrypted = AESUtils.encrypt(key, plainText);
        System.out.println("Encrypted: " + encrypted);

        // Decrypt
        String decrypted = AESUtils.decrypt(key, encrypted);
        System.out.println("Decrypted: " + decrypted);

        // Verify
        assertEquals(plainText, decrypted, "Encryption and decryption results should match");
        System.out.println("Encryption consistency: " + plainText.equals(decrypted));
    }

    @Test
    public void testDifferentKeyLengths() {
        String[] keys = {
                "1234567890123456", // 16-bit
                "123456789012345678901234", // 24-bit
                "12345678901234567890123456789012", // 32-bit
                "short", // Short key
                "verylongkeythatwillbetruncatedto32bytes" // Long key
        };

        String plainText = "Test Text";

        for (String key : keys) {
            String encrypted = AESUtils.encrypt(key, plainText);
            String decrypted = AESUtils.decrypt(key, encrypted);
            assertEquals(plainText, decrypted, "Key length: " + key.length());
        }
    }

    @Test
    public void testSpecialCharacters() {
        String key = "xiaozhi1234567890";
        String[] testTexts = {
                "Hello World",
                "Hello World",
                "Hello, Xiaozhi!",
                "Special characters: !@#$%^&*()",
                "Numbers 123 and mixed text",
                "Emoji: 😀🎉🚀",
                "Empty string test",
                ""
        };

        for (String text : testTexts) {
            String encrypted = AESUtils.encrypt(key, text);
            String decrypted = AESUtils.decrypt(key, encrypted);
            assertEquals(text, decrypted, "Test text: " + text);
        }
    }

    @Test
    public void testCrossLanguageCompatibility() {
        // Python-generated encryption results for cross-language compatibility testing
        String key = "xiaozhi1234567890";
        String plainText = "Hello, Xiaozhi!";

        // Python-generated encryption result
        // String pythonEncrypted = "Encrypted result obtained from Python test";
        // String decrypted = AESUtils.decrypt(key, pythonEncrypted);
        // assertEquals(plainText, decrypted, "Java should decrypt Python encrypted result");

        // Generate Java encrypted result for Python testing
        String javaEncrypted = AESUtils.encrypt(key, plainText);
        System.out.println("Java encrypted result for Python test: " + javaEncrypted);
    }
}