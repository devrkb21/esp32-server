package xiaozhi.modules.home.service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Outcome of a connection test or a device action. `code` is stable for the apps and the robot:
 * ok, not_configured, unreachable, unauthorized, bad_url, not_found, unsupported, bad_value,
 * disabled, error. `message` is a short English detail for logs and support, never a secret.
 */
public record HomeResult(boolean ok, String code, String message, Map<String, Object> extra) {

    public static HomeResult ok(String message) {
        return new HomeResult(true, "ok", message, new LinkedHashMap<>());
    }

    public static HomeResult fail(String code, String message) {
        return new HomeResult(false, code, message, new LinkedHashMap<>());
    }

    public HomeResult with(String key, Object value) {
        extra.put(key, value);
        return this;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", ok);
        out.put("code", code);
        out.put("message", message == null ? "" : message);
        out.putAll(extra);
        return out;
    }
}
