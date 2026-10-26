package xiaozhi.modules.contacts.service;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * Hands a message to xiaozhi-server's companion messages API (POST
 * /companion/v1/devices/{mac}/messages), the same way CompanionController forwards the apps'
 * messages: the server renders the spoken audio and the robot plays it on its next sync.
 */
@Slf4j
@Component
public class CompanionMessenger {
    private final SysParamsService sysParamsService;
    private final RestTemplate restTemplate;

    public CompanionMessenger(SysParamsService sysParamsService, RestTemplate restTemplate) {
        this.sysParamsService = sysParamsService;
        this.restTemplate = restTemplate;
    }

    /** What happened: ok, the stored message (or null), and an error text when not ok. */
    public record Outcome(boolean ok, Map<String, Object> message, String error) {
    }

    public Outcome send(String mac, Map<String, Object> body) {
        String base = baseUrl();
        if (base == null) {
            return new Outcome(false, null, "Companion server address is not configured");
        }
        String url = base + "/companion/v1/devices/" + URLEncoder.encode(mac.toLowerCase(), StandardCharsets.UTF_8) + "/messages";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String secret = sysParamsService.getValue("server.secret", true);
        if (StringUtils.isNotBlank(secret)) {
            headers.setBearerAuth(secret);
        }
        try {
            ResponseEntity<String> resp = restTemplate.exchange(URI.create(url), HttpMethod.POST,
                    new HttpEntity<>(JsonUtils.toJsonString(body), headers), String.class);
            Map<String, Object> msg = StringUtils.isBlank(resp.getBody()) ? null : JsonUtils.parseMap(resp.getBody());
            return new Outcome(true, msg, null);
        } catch (HttpStatusCodeException e) {
            log.warn("Robot message to {} refused: {}", mac, e.getStatusCode());
            return new Outcome(false, null, e.getStatusCode().value() == 404 ? "not_registered" : "refused");
        } catch (Exception e) {
            log.warn("Robot message to {} failed: {}", mac, e.getMessage());
            return new Outcome(false, null, "unreachable");
        }
    }

    /** Same rule as CompanionController: server.companion_api, else the host of server.vision_explain. */
    private String baseUrl() {
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
}
