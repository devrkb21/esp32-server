package xiaozhi.modules.notify.service;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * Server-side reads of xiaozhi-server's companion API (docs/companion-api.md) for the robot watch
 * and the daily summary: the robot list, one robot's full view and its events. Same address and
 * secret as CompanionController.
 */
@Slf4j
@Component
public class CompanionClient {
    private final SysParamsService sysParamsService;
    private final RestTemplate restTemplate;

    public CompanionClient(SysParamsService sysParamsService, RestTemplate restTemplate) {
        this.sysParamsService = sysParamsService;
        this.restTemplate = restTemplate;
    }

    /** The companion API base (server.companion_api, else the host of server.vision_explain), or null. */
    public String baseUrl() {
        for (String key : new String[] { "server.companion_api", "server.vision_explain" }) {
            String value = sysParamsService.getValue(key, true);
            if (StringUtils.isBlank(value) || "null".equalsIgnoreCase(value) || !value.startsWith("http")) {
                continue;
            }
            try {
                URI uri = URI.create(value.trim());
                if (uri.getHost() == null) {
                    continue;
                }
                return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() > 0 ? ":" + uri.getPort() : "");
            } catch (IllegalArgumentException ignored) {
                // try the next one
            }
        }
        return null;
    }

    /** Every robot the companion server knows: [{id (mac), name, online, last_seen, stats, stats_updated}]. */
    public List<Map<String, Object>> devices() {
        Map<String, Object> body = get("/companion/v1/devices");
        Object list = body == null ? null : body.get("devices");
        return list instanceof List<?> ? JsonUtils.toStringObjectMapList(list) : Collections.emptyList();
    }

    /** One robot's full view (settings, alarms, reminders, stats, memories, ...), or null. */
    public Map<String, Object> device(String mac) {
        return get("/companion/v1/devices/" + enc(mac));
    }

    /** The robot's recent events, newest first (at most 200). */
    public List<Map<String, Object>> events(String mac, int limit) {
        Map<String, Object> body = get("/companion/v1/devices/" + enc(mac) + "/events?limit=" + Math.max(1, Math.min(limit, 200)));
        Object list = body == null ? null : body.get("events");
        return list instanceof List<?> ? JsonUtils.toStringObjectMapList(list) : new ArrayList<>();
    }

    private Map<String, Object> get(String path) {
        String base = baseUrl();
        if (base == null) {
            return null;
        }
        HttpHeaders headers = new HttpHeaders();
        String secret = sysParamsService.getValue("server.secret", true);
        if (StringUtils.isNotBlank(secret)) {
            headers.setBearerAuth(secret);
        }
        try {
            ResponseEntity<String> r = restTemplate.exchange(URI.create(base + path), HttpMethod.GET,
                    new HttpEntity<>(headers), String.class);
            return StringUtils.isBlank(r.getBody()) ? null : JsonUtils.parseMap(r.getBody());
        } catch (Exception e) {
            log.debug("Companion GET {} failed: {}", path, e.getMessage());
            return null;
        }
    }

    private static String enc(String mac) {
        return URLEncoder.encode(mac == null ? "" : mac.toLowerCase(), StandardCharsets.UTF_8);
    }
}
