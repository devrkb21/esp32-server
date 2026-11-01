package xiaozhi.modules.shopbridge;

import java.util.List;

/**
 * Phone numbers as the shop and manager-api write them. A Bangladeshi mobile may be stored as
 * 01712345678, 8801712345678 or +8801712345678 (registration accepts all three), so an account is
 * looked up under every form and a new one is made with the local form. Pure, unit-tested.
 */
public final class ShopBridgePhone {
    private ShopBridgePhone() {
    }

    /** 01712345678 for a Bangladeshi mobile in any form, +<digits> for another country, else null. */
    public static String canonical(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.replaceAll("[\\s\\-()]", "");
        String digits = s.startsWith("+") ? s.substring(1) : s;
        if (!digits.matches("\\d{6,16}")) {
            return null;
        }
        if (digits.matches("8801[3-9]\\d{8}")) {
            return "0" + digits.substring(3);
        }
        if (digits.matches("01[3-9]\\d{8}")) {
            return digits;
        }
        return s.startsWith("+") ? "+" + digits : null;
    }

    /** Every form an existing account may use, the canonical one first. */
    public static List<String> variants(String raw) {
        String c = canonical(raw);
        if (c == null) {
            return List.of();
        }
        if (c.startsWith("01")) {
            String national = c.substring(1);
            return List.of(c, "880" + national, "+880" + national);
        }
        return List.of(c);
    }
}
