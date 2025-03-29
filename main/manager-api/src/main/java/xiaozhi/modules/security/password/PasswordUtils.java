package xiaozhi.modules.security.***REDACTED***;

/**
 * 密码工具类
 * Copyright (c) 人人开源 All rights reserved.
 * Website: https://www.renren.io
 */
public class PasswordUtils {
    private static PasswordEncoder ***REDACTED***Encoder = new BCryptPasswordEncoder();

    /**
     * 加密
     *
     * @param str 字符串
     * @return 返回加密字符串
     */
    public static String encode(String str) {
        return ***REDACTED***Encoder.encode(str);
    }

    /**
     * 比较密码是否相等
     *
     * @param str      明文密码
     * @param ***REDACTED*** 加密后密码
     * @return true：成功 false：失败
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
