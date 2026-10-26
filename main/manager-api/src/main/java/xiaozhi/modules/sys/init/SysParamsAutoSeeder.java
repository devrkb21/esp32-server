package xiaozhi.modules.sys.init;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * Automatically seeds and repairs system parameters on application startup.
 * Web and OTA use the domain. With PUBLIC_URL (default: https://SERVER_DOMAIN, behind a reverse
 * proxy) the robot's WebSocket, companion and vision/MCP addresses use it too; PUBLIC_URL=off keeps
 * them on the direct public IP and ports (a LAN setup without a proxy). MQTT and UDP always use the
 * direct IP: a proxy such as Cloudflare does not carry them.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SysParamsAutoSeeder {

    private final SysParamsService sysParamsService;

    @Value("${SERVER_DOMAIN:esp.czbd.app}")
    private String serverDomain;

    @Value("${MQTT_PUBLIC_IP:13.201.26.73}")
    private String mqttPublicIp;

    // false: no MQTT gateway (e.g. a LAN setup): devices get only the WebSocket address
    @Value("${MQTT_ENABLED:true}")
    private boolean mqttEnabled;

    @Value("${MQTT_PORT:1883}")
    private String mqttPort;

    @Value("${UDP_PORT:8884}")
    private String udpPort;

    @Value("${MQTT_API_PORT:8007}")
    private String mqttApiPort;

    @Value("${MQTT_SIGNATURE_KEY:}")
    private String mqttSignatureKey;

    @Value("${MANAGER_API_SECRET:}")
    private String managerApiSecret;

    @Value("${VOICEPRINT_KEY:}")
    private String voiceprintKey;

    @Value("${WS_PORT:18000}")
    private String wsPort;

    @Value("${VISION_PORT:18003}")
    private String visionPort;

    // auto: https://SERVER_DOMAIN; off (or empty): direct IP and ports; anything else: that base URL
    @Value("${PUBLIC_URL:auto}")
    private String publicUrl;

    public void seedParams() {
        String cleanHost = cleanDomain(serverDomain);
        log.info("Checking and auto-seeding system parameters (Domain: {}, Public IP: {})...", cleanHost, mqttPublicIp);

        // 1. Frontend URL (Web UI domain)
        String domainUrl = "https://" + cleanHost;
        checkAndSet("server.fronted_url", domainUrl, "Control panel URL displayed when sending 6-digit verification code", false);

        // 2. OTA Address (Web UI domain)
        checkAndSet("server.ota", domainUrl, "OTA Server Address", false);

        // Addresses the robot reaches over HTTP(S) / WebSocket: through the public URL when there is one
        String base = publicBase(cleanHost);
        String directWs = "ws://" + mqttPublicIp + ":" + wsPort + "/xiaozhi/v1/;wss://" + cleanHost + "/ws";
        String directVision = "http://" + mqttPublicIp + ":" + visionPort + "/mcp/vision/explain";
        String directMcp = "http://" + mqttPublicIp + ":" + visionPort + "/mcp/";
        String directCompanion = "http://" + mqttPublicIp + ":" + visionPort;

        // 3. WebSocket Address
        if (base != null) {
            String wsBase = base.replaceFirst("^https://", "wss://").replaceFirst("^http://", "ws://");
            seedUrl("server.websocket", wsBase + "/ws", "WebSocket addresses, separated by semicolon", directWs);
        } else {
            checkAndSet("server.websocket", directWs, "WebSocket addresses, separated by semicolon", false);
        }

        if (mqttEnabled) {
            // 4. MQTT Gateway (Direct Public IP with Port 1883 for ESP32 devices)
            String mqttGateway = mqttPublicIp + ":" + mqttPort;
            checkAndSet("server.mqtt_gateway", mqttGateway, "MQTT gateway configuration", true);

            // 5. UDP Gateway (Direct Public IP with Port 8884 for ESP32 devices)
            String udpGateway = mqttPublicIp + ":" + udpPort;
            checkAndSet("server.udp_gateway", udpGateway, "UDP gateway configuration", true);
        } else {
            // A configured gateway would make devices use MQTT, which has nothing listening
            disable("server.mqtt_gateway", "MQTT gateway configuration");
            disable("server.udp_gateway", "UDP gateway configuration");
        }

        // 6. MQTT Signature Key: the gateway reads it from the environment, so the database must
        //    always hold the same value (otherwise devices get credentials the gateway rejects).
        syncSecret("server.mqtt_signature_key", mqttSignatureKey, "MQTT Secret Key Configuration");

        // 7. MQTT Manager API (Docker internal communication)
        if (mqttEnabled) {
            String mqttApi = "xiaozhi-esp32-server-mqtt:" + mqttApiPort;
            checkAndSet("server.mqtt_manager_api", mqttApi, "MQTT gateway management API address", false);
        } else {
            disable("server.mqtt_manager_api", "MQTT gateway management API address");
        }

        // 8. Server Secret: xiaozhi-server and the gateway read it from the environment
        syncSecret("server.secret", managerApiSecret, "Server Secret Key");

        // 9. Voiceprint Endpoint
        if (StringUtils.isNotBlank(voiceprintKey)) {
            String voiceprintUrl = "http://xiaozhi-esp32-server-voiceprint:8005/voiceprint/health?key=" + voiceprintKey;
            syncSecret("server.voice_print", voiceprintUrl, "Voiceprint API address");
        }

        // 10. Voiceprint Similarity Threshold
        checkAndSet("server.voiceprint_similarity_threshold", "0.4", "Voiceprint similarity threshold", false);

        // 11. Vision Explain URL / 12. MCP Endpoint / 12b. Companion API base (robots sync with it)
        if (base != null) {
            seedUrl("server.vision_explain", base + "/mcp/vision/explain", "Vision analysis interface URL sent to device", directVision);
            seedUrl("server.mcp_endpoint", base + "/mcp/", "MCP Endpoint Address", directMcp);
            seedUrl("server.companion_url", base, "Companion API base URL sent to the robot in the OTA reply (no trailing slash)", directCompanion);
        } else {
            checkAndSet("server.vision_explain", directVision, "Vision analysis interface URL sent to device", true);
            checkAndSet("server.mcp_endpoint", directMcp, "MCP Endpoint Address", true);
        }

        // 13. Server Name
        checkAndSet("server.name", "Xiaozhi AI Server", "System Name", false);

        // 14. Server Auth Enabled
        checkAndSet("server.auth.enabled", "true", "Whether server module enables token authentication", false);

        log.info("System parameters auto-seeding finished.");
    }

    private void disable(String code, String remark) {
        try {
            String current = sysParamsService.getValue(code, false);
            if (!"null".equals(current)) {
                log.info("MQTT disabled: setting sys_params [{}] to null", code);
                sysParamsService.setParam(code, "null", remark);
            }
        } catch (Exception e) {
            log.error("Failed to disable parameter [{}]: {}", code, e.getMessage());
        }
    }

    /**
     * Secrets come from the environment (.env) and are never committed. When one is set, the
     * database copy is kept identical so a rotation in .env takes effect on the next restart.
     */
    private void syncSecret(String code, String envValue, String remark) {
        if (StringUtils.isBlank(envValue)) {
            log.warn("{} is not set in the environment; keeping the database value", code);
            return;
        }
        try {
            String current = sysParamsService.getValue(code, false);
            if (!envValue.equals(current)) {
                log.info("Syncing sys_params [{}] from the environment", code);
                sysParamsService.setParam(code, envValue, remark);
            }
        } catch (Exception e) {
            log.error("Failed to sync parameter [{}]: {}", code, e.getMessage());
        }
    }

    private void checkAndSet(String code, String targetValue, String remark, boolean forceIpCheck) {
        try {
            String current = sysParamsService.getValue(code, false);
            boolean shouldUpdate = StringUtils.isBlank(current)
                    || "null".equalsIgnoreCase(current)
                    || current.contains("xiaozhi.server.com");

            if (forceIpCheck && !shouldUpdate) {
                // If IP is 127.0.0.1 or localhost, update to public IP
                if (current.contains("127.0.0.1") || current.contains("localhost")) {
                    shouldUpdate = true;
                }
            }

            if (shouldUpdate) {
                log.info("Auto-seeding sys_params [{}] -> {}", code, targetValue);
                sysParamsService.setParam(code, targetValue, remark);
            }
        } catch (Exception e) {
            log.error("Failed to auto-seed parameter [{}]: {}", code, e.getMessage());
        }
    }

    /** The public base URL without a trailing slash, or null when the robot uses the direct IP and ports. */
    private String publicBase(String cleanHost) {
        String v = publicUrl == null ? "" : publicUrl.trim();
        if (v.isEmpty() || "off".equalsIgnoreCase(v) || "none".equalsIgnoreCase(v)) {
            return null;
        }
        if ("auto".equalsIgnoreCase(v)) {
            return "https://" + cleanHost;
        }
        return v.replaceAll("/+$", "");
    }

    /**
     * Seeds an address unless an admin has set it: it is replaced only while it is empty, a
     * placeholder, local, or still one of the values this seeder used to write (the direct IP form).
     */
    private void seedUrl(String code, String targetValue, String remark, String... autoValues) {
        try {
            String current = sysParamsService.getValue(code, false);
            boolean auto = StringUtils.isBlank(current) || "null".equalsIgnoreCase(current)
                    || current.contains("xiaozhi.server.com") || current.contains("127.0.0.1") || current.contains("localhost");
            for (String a : autoValues) {
                auto = auto || a.equals(current);
            }
            if (auto && !targetValue.equals(current)) {
                log.info("Auto-seeding sys_params [{}] -> {}", code, targetValue);
                sysParamsService.setParam(code, targetValue, remark);
            }
        } catch (Exception e) {
            log.error("Failed to auto-seed parameter [{}]: {}", code, e.getMessage());
        }
    }

    private String cleanDomain(String domain) {
        if (StringUtils.isBlank(domain)) {
            return "esp.czbd.app";
        }
        return domain.trim().replaceAll("^https?://", "").replaceAll("/.*$", "");
    }
}
