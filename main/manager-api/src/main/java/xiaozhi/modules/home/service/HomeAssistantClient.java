package xiaozhi.modules.home.service;

import java.net.ConnectException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import xiaozhi.common.utils.JsonUtils;

/**
 * The few Home Assistant REST calls the smart-home module needs (GET /api/config, GET /api/states,
 * POST /api/services/{domain}/{service}), authenticated with the user's long-lived access token.
 * Never logs or returns the token. Tested against a fake Home Assistant in HomeAssistantClientTest.
 */
public class HomeAssistantClient {
    private final HttpClient http;
    private final Duration timeout;

    public HomeAssistantClient() {
        this(Duration.ofSeconds(6));
    }

    public HomeAssistantClient(Duration timeout) {
        this.timeout = timeout;
        this.http = HttpClient.newBuilder().connectTimeout(timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }

    /** One entity from GET /api/states, reduced to what the device list needs. */
    public record Entity(String entityId, String domain, String name, String state) {
    }

    /**
     * Normalized base URL ("http(s)://host[:port][/path]" without a trailing slash, or without a
     * trailing /api), or null when it is not an http(s) URL.
     */
    public static String normalizeBaseUrl(String url) {
        if (url == null) {
            return null;
        }
        String s = url.trim();
        while (s.endsWith("/")) {
            s = s.substring(0, s.length() - 1);
        }
        if (s.toLowerCase(Locale.ROOT).endsWith("/api")) {
            s = s.substring(0, s.length() - 4);
        }
        try {
            URI u = URI.create(s);
            String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            if (!("http".equals(scheme) || "https".equals(scheme)) || u.getHost() == null || u.getRawQuery() != null
                    || u.getRawFragment() != null || u.getRawUserInfo() != null) {
                return null;
            }
        } catch (IllegalArgumentException e) {
            return null;
        }
        return s.length() > 300 ? null : s;
    }

    /** GET /api/config: is the hub reachable and is the token accepted? extra: version, location. */
    public HomeResult check(String baseUrl, String token) {
        HomeResult pre = precheck(baseUrl, token);
        if (pre != null) {
            return pre;
        }
        return send(baseUrl, token, "GET", "/api/config", null, body -> {
            Map<String, Object> cfg = JsonUtils.parseMap(body);
            HomeResult r = HomeResult.ok("Home Assistant answered");
            Object version = cfg.get("version");
            if (version != null) {
                r.with("version", String.valueOf(version));
            }
            Object name = cfg.get("location_name");
            if (name != null) {
                r.with("location", String.valueOf(name));
            }
            return r;
        });
    }

    /** GET /api/states, only entities of the given domains. On failure: extra "entities" is absent. */
    public HomeResult states(String baseUrl, String token, List<String> domains) {
        HomeResult pre = precheck(baseUrl, token);
        if (pre != null) {
            return pre;
        }
        return send(baseUrl, token, "GET", "/api/states", null, body -> {
            List<Map<String, Object>> rows = JsonUtils.parseMapList(body);
            List<Entity> out = new ArrayList<>();
            for (Map<String, Object> row : rows == null ? List.<Map<String, Object>>of() : rows) {
                Object idObj = row.get("entity_id");
                if (!(idObj instanceof String id) || id.indexOf('.') < 1) {
                    continue;
                }
                String domain = id.substring(0, id.indexOf('.'));
                if (!domains.contains(domain)) {
                    continue;
                }
                String name = id;
                Object attrs = row.get("attributes");
                if (attrs instanceof Map<?, ?> a && a.get("friendly_name") instanceof String fn && !fn.isBlank()) {
                    name = fn.trim();
                }
                Object state = row.get("state");
                out.add(new Entity(id, domain, name, state == null ? "" : String.valueOf(state)));
            }
            return HomeResult.ok(out.size() + " entities").with("entities", out);
        });
    }

    /** POST /api/services/{domain}/{service} for one entity. */
    public HomeResult call(String baseUrl, String token, HomeActions.ServiceCall call, String entityId) {
        HomeResult pre = precheck(baseUrl, token);
        if (pre != null) {
            return pre;
        }
        Map<String, Object> data = new LinkedHashMap<>(call.data());
        data.put("entity_id", entityId);
        String path = "/api/services/" + call.domain() + "/" + call.service();
        return send(baseUrl, token, "POST", path, JsonUtils.toJsonString(data),
                body -> HomeResult.ok(call.name()).with("service", call.name()));
    }

    // ------------------------------------------------------------------ plumbing
    private interface BodyReader {
        HomeResult read(String body);
    }

    private static HomeResult precheck(String baseUrl, String token) {
        if (baseUrl == null || baseUrl.isBlank() || token == null || token.isBlank()) {
            return HomeResult.fail("not_configured", "Home Assistant is not set up");
        }
        if (normalizeBaseUrl(baseUrl) == null) {
            return HomeResult.fail("bad_url", "The Home Assistant address is not a valid http(s) URL");
        }
        return null;
    }

    private HomeResult send(String baseUrl, String token, String method, String path, String json, BodyReader reader) {
        String base = normalizeBaseUrl(baseUrl);
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path))
                .timeout(timeout)
                .header("Authorization", "Bearer " + token.trim())
                .header("Accept", "application/json");
        if ("POST".equals(method)) {
            b.header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json == null ? "{}" : json, StandardCharsets.UTF_8));
        } else {
            b.GET();
        }
        HttpResponse<String> resp;
        try {
            resp = http.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (HttpConnectTimeoutException | ConnectException e) {
            return HomeResult.fail("unreachable", "Home Assistant did not answer at " + base);
        } catch (HttpTimeoutException e) {
            return HomeResult.fail("unreachable", "Home Assistant timed out");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return HomeResult.fail("unreachable", "Interrupted");
        } catch (Exception e) {
            return HomeResult.fail("unreachable", "Home Assistant could not be reached: " + e.getClass().getSimpleName());
        }
        int status = resp.statusCode();
        if (status == 401 || status == 403) {
            return HomeResult.fail("unauthorized", "Home Assistant refused the access token");
        }
        if (status == 404) {
            return HomeResult.fail("not_found", "Home Assistant has no " + path);
        }
        if (status == 400) {
            return HomeResult.fail("unsupported", "Home Assistant refused the request");
        }
        if (status < 200 || status >= 300) {
            return HomeResult.fail("error", "Home Assistant answered HTTP " + status);
        }
        try {
            return reader.read(resp.body());
        } catch (Exception e) {
            return HomeResult.fail("error", "Home Assistant sent an answer that could not be read");
        }
    }
}
