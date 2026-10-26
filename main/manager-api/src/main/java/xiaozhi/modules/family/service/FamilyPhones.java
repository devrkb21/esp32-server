package xiaozhi.modules.family.service;

import java.util.LinkedHashSet;
import java.util.Set;

import xiaozhi.common.validator.ValidatorUtils;

/**
 * Finding an account by phone number. Accounts registered with SMS use their phone number as
 * the username, in whatever form was typed then. A Bangladeshi number (+880) may have been
 * stored as +8801XXXXXXXXX, 8801XXXXXXXXX or 01XXXXXXXXX: all three are tried.
 */
public final class FamilyPhones {
    private FamilyPhones() {
    }

    /**
     * The usernames an invite target may match: the text itself (trimmed) and, for a
     * Bangladeshi mobile number, its three spellings. Spaces and dashes inside a number are
     * ignored.
     */
    public static Set<String> candidates(String raw) {
        Set<String> out = new LinkedHashSet<>();
        if (raw == null) {
            return out;
        }
        String text = raw.trim();
        if (text.isEmpty()) {
            return out;
        }
        out.add(text);
        String compact = text.replaceAll("[ ()-]", "");
        String local = bangladeshLocal(compact);
        if (local != null) {
            out.add(local);
            out.add("880" + local.substring(1));
            out.add("+880" + local.substring(1));
        } else if (!compact.equals(text) && ValidatorUtils.isValidPhone(compact)) {
            out.add(compact);
        }
        return out;
    }

    /** 01XXXXXXXXX for a valid Bangladeshi mobile number in any of its forms, else null. */
    public static String bangladeshLocal(String compact) {
        if (compact == null) {
            return null;
        }
        String local;
        if (compact.startsWith("+880")) {
            local = "0" + compact.substring(4);
        } else if (compact.startsWith("880")) {
            local = "0" + compact.substring(3);
        } else {
            local = compact;
        }
        return local.matches("^01[3-9][0-9]{8}$") ? local : null;
    }

    /** Looks like a phone number (digits, an optional leading +). */
    public static boolean looksLikePhone(String raw) {
        return raw != null && raw.trim().replaceAll("[ ()-]", "").matches("^[+]?[0-9]{6,16}$");
    }
}
