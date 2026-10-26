package xiaozhi.modules.home.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * What an action on a smart-home device means: the Home Assistant service to call (with its
 * data), or the MQTT payload to publish. One table for the apps' test buttons and the robot's
 * voice tool, so both switch a device the same way. Pure: unit tested in HomeActionsTest.
 */
public final class HomeActions {
    private HomeActions() {
    }

    /** Device kinds the robot can switch (Home Assistant domains). */
    public static final List<String> DOMAINS = List.of("light", "switch", "fan", "climate", "cover");
    /** Actions the apps and the robot may ask for. */
    public static final Set<String> ACTIONS = Set.of("on", "off", "toggle", "set_temperature", "set_brightness",
            "set_speed", "open", "close", "stop");

    public static final int MIN_TEMPERATURE = 16;
    public static final int MAX_TEMPERATURE = 30;

    /** A Home Assistant service call: POST /api/services/{domain}/{service} with data (entity_id added by the caller). */
    public record ServiceCall(String domain, String service, Map<String, Object> data) {
        public String name() {
            return domain + "." + service;
        }
    }

    public static boolean knownDomain(String domain) {
        return domain != null && DOMAINS.contains(domain);
    }

    public static String normalizeAction(String action) {
        return action == null ? "" : action.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * The Home Assistant service for an action on a device of this domain.
     *
     * @throws IllegalArgumentException with a short code ("unsupported", "bad_value") when the
     *                                  action does not fit the device
     */
    public static ServiceCall haCall(String domain, String action, Number value) {
        String a = normalizeAction(action);
        Map<String, Object> data = new LinkedHashMap<>();
        switch (domain == null ? "" : domain) {
            case "light":
                if ("set_brightness".equals(a)) {
                    data.put("brightness_pct", percent(value));
                    return new ServiceCall("light", "turn_on", data);
                }
                return onOffToggle("light", a);
            case "switch":
                return onOffToggle("switch", a);
            case "fan":
                if ("set_speed".equals(a)) {
                    data.put("percentage", percent(value));
                    return new ServiceCall("fan", "set_percentage", data);
                }
                return onOffToggle("fan", a);
            case "climate":
                if ("set_temperature".equals(a)) {
                    data.put("temperature", temperature(value));
                    return new ServiceCall("climate", "set_temperature", data);
                }
                if ("on".equals(a) || "off".equals(a)) {
                    return new ServiceCall("climate", "on".equals(a) ? "turn_on" : "turn_off", data);
                }
                throw new IllegalArgumentException("unsupported");
            case "cover":
                if ("open".equals(a) || "on".equals(a)) {
                    return new ServiceCall("cover", "open_cover", data);
                }
                if ("close".equals(a) || "off".equals(a)) {
                    return new ServiceCall("cover", "close_cover", data);
                }
                if ("stop".equals(a)) {
                    return new ServiceCall("cover", "stop_cover", data);
                }
                if ("toggle".equals(a)) {
                    return new ServiceCall("cover", "toggle", data);
                }
                throw new IllegalArgumentException("unsupported");
            default:
                throw new IllegalArgumentException("unsupported");
        }
    }

    /** The MQTT payload for an action on a generic device (on/open: payload_on, off/close: payload_off). */
    public static String mqttPayload(String action, String payloadOn, String payloadOff) {
        String a = normalizeAction(action);
        if ("on".equals(a) || "open".equals(a)) {
            return payloadOn == null || payloadOn.isEmpty() ? "ON" : payloadOn;
        }
        if ("off".equals(a) || "close".equals(a)) {
            return payloadOff == null || payloadOff.isEmpty() ? "OFF" : payloadOff;
        }
        throw new IllegalArgumentException("unsupported");
    }

    private static ServiceCall onOffToggle(String domain, String a) {
        switch (a) {
            case "on":
            case "open":
                return new ServiceCall(domain, "turn_on", new LinkedHashMap<>());
            case "off":
            case "close":
                return new ServiceCall(domain, "turn_off", new LinkedHashMap<>());
            case "toggle":
                return new ServiceCall(domain, "toggle", new LinkedHashMap<>());
            default:
                throw new IllegalArgumentException("unsupported");
        }
    }

    private static Object temperature(Number value) {
        if (value == null || Double.isNaN(value.doubleValue())) {
            throw new IllegalArgumentException("bad_value");
        }
        double t = value.doubleValue();
        if (t < MIN_TEMPERATURE || t > MAX_TEMPERATURE) {
            throw new IllegalArgumentException("bad_value");
        }
        if (t == Math.rint(t)) {
            return Integer.valueOf((int) t);
        }
        return Double.valueOf(Math.round(t * 2) / 2.0);
    }

    private static int percent(Number value) {
        if (value == null || Double.isNaN(value.doubleValue())) {
            throw new IllegalArgumentException("bad_value");
        }
        long p = Math.round(value.doubleValue());
        if (p < 0 || p > 100) {
            throw new IllegalArgumentException("bad_value");
        }
        return (int) p;
    }
}
