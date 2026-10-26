package xiaozhi.modules.device.controller;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.user.UserDetail;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.family.service.DeviceAccess;
import xiaozhi.modules.family.service.FamilyRole.Action;
import xiaozhi.modules.product.service.ProductService;
import xiaozhi.modules.security.user.SecurityUser;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * TinyBot companion settings (alarms, reminders, focus timer, prayer times, night mode, phone
 * messages and commands). The data lives in xiaozhi-server's companion API (see
 * docs/companion-api.md); this controller checks that the logged-in user may use the device (its
 * owner or family, see DeviceAccess) and forwards the request, authenticated with the shared server secret.
 */
@Slf4j
@Tag(name = "Companion")
@RestController
@RequestMapping("/device/companion")
public class CompanionController {
    private final DeviceService deviceService;
    private final SysParamsService sysParamsService;
    private final RestTemplate restTemplate;
    private final ProductService productService;

    public CompanionController(DeviceService deviceService, SysParamsService sysParamsService,
            RestTemplate restTemplate, ProductService productService) {
        this.deviceService = deviceService;
        this.sysParamsService = sysParamsService;
        this.restTemplate = restTemplate;
        this.productService = productService;
    }

    @GetMapping("/{deviceId}")
    @Operation(summary = "Companion config, stats, events and messages of a device")
    @RequiresPermissions("sys:role:normal")
    public Result<Object> get(@PathVariable String deviceId) {
        return forward(deviceId, HttpMethod.GET, "", null);
    }

    @PutMapping("/{deviceId}/config")
    @Operation(summary = "Update companion config (partial)")
    @RequiresPermissions("sys:role:normal")
    public Result<Object> updateConfig(@PathVariable String deviceId, @RequestBody Map<String, Object> body) {
        return forward(deviceId, HttpMethod.PUT, "/config", body);
    }

    @GetMapping("/{deviceId}/messages")
    @Operation(summary = "Phone messages sent to the robot and their replies")
    @RequiresPermissions("sys:role:normal")
    public Result<Object> messages(@PathVariable String deviceId) {
        return forward(deviceId, HttpMethod.GET, "/messages", null);
    }

    @PostMapping("/{deviceId}/messages")
    @Operation(summary = "Send a message for the robot to speak")
    @RequiresPermissions("sys:role:normal")
    public Result<Object> sendMessage(@PathVariable String deviceId, @RequestBody Map<String, Object> body) {
        return forward(deviceId, HttpMethod.POST, "/messages", body);
    }

    @PostMapping("/{deviceId}/commands")
    @Operation(summary = "Queue a command (story, pomodoro, lullaby, ring, breathe, night_light, game)")
    @RequiresPermissions("sys:role:normal")
    public Result<Object> command(@PathVariable String deviceId, @RequestBody Map<String, Object> body) {
        return forward(deviceId, HttpMethod.POST, "/commands", body);
    }

    @GetMapping("/{deviceId}/events")
    @Operation(summary = "Recent robot events")
    @RequiresPermissions("sys:role:normal")
    public Result<Object> events(@PathVariable String deviceId,
            @RequestParam(value = "limit", required = false, defaultValue = "50") int limit) {
        return forward(deviceId, HttpMethod.GET, "/events?limit=" + Math.max(1, Math.min(limit, 200)), null);
    }

    @GetMapping("/geocode")
    @Operation(summary = "City search for prayer times and weather")
    @RequiresPermissions("sys:role:normal")
    public Result<Object> geocode(@RequestParam("q") String query) {
        String base = companionBaseUrl();
        if (base == null) {
            return new Result<Object>().error("Companion server address is not configured");
        }
        String url = base + "/companion/v1/geocode?q=" + URLEncoder.encode(query, StandardCharsets.UTF_8);
        return exchange(url, HttpMethod.GET, null);
    }

    private Result<Object> forward(String deviceId, HttpMethod method, String path, Object body) {
        DeviceEntity device = deviceService.selectById(deviceId);
        UserDetail user = SecurityUser.getUser();
        // The owner and the robot's family (members and co-owners) use the companion screens
        if (device == null || user == null || !DeviceAccess.can(device, user.getId(), Action.USE)
                || StringUtils.isBlank(device.getMacAddress())) {
            return new Result<Object>().error(ErrorCode.DEVICE_NOT_EXIST);
        }
        // Only products with the companion module (TinyBot) have day/alarms/prayer/look/messages/...
        productService.requireFeature(device.getBoard(), ProductService.FEATURE_COMPANION);
        String base = companionBaseUrl();
        if (base == null) {
            return new Result<Object>().error("Companion server address is not configured");
        }
        String mac = URLEncoder.encode(device.getMacAddress().toLowerCase(), StandardCharsets.UTF_8);
        return exchange(base + "/companion/v1/devices/" + mac + path, method, body);
    }

    private Result<Object> exchange(String url, HttpMethod method, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String secret = sysParamsService.getValue("server.secret", true);
        if (StringUtils.isNotBlank(secret)) {
            headers.setBearerAuth(secret);
        }
        HttpEntity<String> entity = new HttpEntity<>(body == null ? null : JsonUtils.toJsonString(body), headers);
        try {
            ResponseEntity<String> response = restTemplate.exchange(URI.create(url), method, entity, String.class);
            Object data = StringUtils.isBlank(response.getBody()) ? null
                    : JsonUtils.parseObject(response.getBody(), Object.class);
            return new Result<Object>().ok(data);
        } catch (HttpStatusCodeException e) {
            String msg = e.getResponseBodyAsString();
            try {
                Object err = JsonUtils.parseMap(msg).get("error");
                if (err != null) {
                    msg = String.valueOf(err);
                }
            } catch (Exception ignored) {
                // not JSON: keep the raw text
            }
            log.warn("Companion {} {} -> {}: {}", method, url, e.getStatusCode(), msg);
            return new Result<Object>().error(StringUtils.defaultIfBlank(msg, "Companion server error"));
        } catch (Exception e) {
            log.warn("Companion {} {} failed: {}", method, url, e.getMessage());
            return new Result<Object>().error("Companion server is not reachable");
        }
    }

    /**
     * Base URL of xiaozhi-server's HTTP port: the `server.companion_api` param when set,
     * otherwise the host of `server.vision_explain` (also served on xiaozhi-server's port 8003;
     * `server.ota` is not used: it points at manager-api itself).
     */
    private String companionBaseUrl() {
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
