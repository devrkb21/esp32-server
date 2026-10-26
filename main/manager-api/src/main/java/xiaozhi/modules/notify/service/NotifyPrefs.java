package xiaozhi.modules.notify.service;

import java.util.LinkedHashMap;
import java.util.Map;

import lombok.Data;

/**
 * What a user wants to hear about. Stored as JSON in ai_notify_pref.prefs; missing keys take the
 * defaults (every group on, offline after 30 minutes, the daily summary pushed).
 */
@Data
public class NotifyPrefs {
    public static final int OFFLINE_DEFAULT = 30;
    public static final int OFFLINE_MIN = 10;
    public static final int OFFLINE_MAX = 720;

    private Map<String, Boolean> types = new LinkedHashMap<>();
    private int offlineMinutes = OFFLINE_DEFAULT;
    private boolean summaryPush = true;

    public NotifyPrefs() {
        for (String g : NotifyTypes.GROUPS) {
            types.put(g, Boolean.TRUE);
        }
    }

    public boolean wants(String group) {
        if (group == null) {
            return true;
        }
        Boolean on = types.get(group);
        return on == null || on;
    }

    /** Reads stored JSON (already parsed); unknown keys are ignored, bad values keep defaults. */
    @SuppressWarnings("unchecked")
    public static NotifyPrefs from(Map<String, Object> raw) {
        NotifyPrefs p = new NotifyPrefs();
        p.apply(raw);
        return p;
    }

    /** Merges a partial update. Returns this. */
    @SuppressWarnings("unchecked")
    public NotifyPrefs apply(Map<String, Object> raw) {
        if (raw == null) {
            return this;
        }
        Object t = raw.get("types");
        if (t instanceof Map<?, ?> m) {
            for (Map.Entry<?, ?> e : m.entrySet()) {
                String key = String.valueOf(e.getKey());
                if (NotifyTypes.GROUPS.contains(key) && e.getValue() instanceof Boolean b) {
                    types.put(key, b);
                }
            }
        }
        Object mins = raw.get("offlineMinutes");
        if (mins instanceof Number n) {
            offlineMinutes = Math.max(OFFLINE_MIN, Math.min(OFFLINE_MAX, n.intValue()));
        }
        Object sp = raw.get("summaryPush");
        if (sp instanceof Boolean b) {
            summaryPush = b;
        }
        return this;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("types", new LinkedHashMap<>(types));
        out.put("offlineMinutes", offlineMinutes);
        out.put("summaryPush", summaryPush);
        return out;
    }
}
