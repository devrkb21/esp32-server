package xiaozhi.modules.notify.service;

/**
 * Bangla numerals and times for server-written texts (notifications, the daily summary).
 */
public final class BnText {
    private static final char[] DIGITS = { '০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯' };

    private BnText() {
    }

    /** Western digits in a text turned into Bangla digits. */
    public static String digits(Object value) {
        String s = String.valueOf(value);
        StringBuilder out = new StringBuilder(s.length());
        for (char c : s.toCharArray()) {
            out.append(c >= '0' && c <= '9' ? DIGITS[c - '0'] : c);
        }
        return out.toString();
    }

    /** "HH:MM" (24 h) as a 12-hour Bangla time without am/pm ("৯:০৫"), like the apps show it. */
    public static String time(String hhmm) {
        if (hhmm == null || !hhmm.matches("^\\d{1,2}:\\d{2}$")) {
            return hhmm == null ? "" : hhmm;
        }
        String[] p = hhmm.split(":");
        int h = Integer.parseInt(p[0]) % 12;
        return digits((h == 0 ? 12 : h) + ":" + p[1]);
    }

    /** "HH:MM" as "9:05 am" for English texts. */
    public static String timeEn(String hhmm) {
        if (hhmm == null || !hhmm.matches("^\\d{1,2}:\\d{2}$")) {
            return hhmm == null ? "" : hhmm;
        }
        String[] p = hhmm.split(":");
        int h24 = Integer.parseInt(p[0]);
        int h = h24 % 12;
        return (h == 0 ? 12 : h) + ":" + p[1] + (h24 < 12 ? " am" : " pm");
    }
}
