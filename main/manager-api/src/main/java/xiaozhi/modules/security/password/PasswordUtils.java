package xiaozhi.modules.security.password;

/**
 * PasswordUtility class
 * Copyright (c) Renren Open Source. All rights reserved.
 * Website: https://www.renren.io
 */
public class PasswordUtils {
    private static PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /**
     * Encrypt
     *
     * @param str String
     * @return Returns encryptedString
     */
    public static String encode(String str) {
        return passwordEncoder.encode(str);
    }

    /**
     * ComparePasswordWhether equal
     *
     * @param str      PlaintextPassword
     * @param password EncryptedPassword
     * @return true：Success false：Fail
     */
    public static boolean matches(String str, String password) {
        return passwordEncoder.matches(str, password);
    }

    public static void main(String[] args) {
        String str = "admin";
        String password = encode(str);

        System.out.println(password);
        System.out.println(matches(str, password));
    }

}
