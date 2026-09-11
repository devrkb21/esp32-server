package xiaozhi.modules.security.***REDACTED***;

/**
 * PasswordUtility class
 * Copyright (c) Renren Open Source. All rights reserved.
 * Website: https://www.renren.io
 */
public class PasswordUtils {
    private static PasswordEncoder ***REDACTED***Encoder = new BCryptPasswordEncoder();

    /**
     * Encrypt
     *
     * @param str String
     * @return Returns encryptedString
     */
    public static String encode(String str) {
        return ***REDACTED***Encoder.encode(str);
    }

    /**
     * ComparePasswordWhether equal
     *
     * @param str      PlaintextPassword
     * @param ***REDACTED*** EncryptedPassword
     * @return true：Success false：Fail
     */
    public static boolean matches(String str, String ***REDACTED***) {
        return ***REDACTED***Encoder.matches(str, ***REDACTED***);
    }

    public static void main(String[] args) {
        String str = "admin";
        String ***REDACTED*** = encode(str);

        System.out.println(***REDACTED***);
        System.out.println(matches(str, ***REDACTED***));
    }

}
