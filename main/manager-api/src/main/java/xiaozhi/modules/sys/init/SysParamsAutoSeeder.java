package xiaozhi.modules.sys.init;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * Automatically seeds and repairs system parameters on application startup.
 * Uses domain for web/OTA, and direct public IP for hardware ports (MQTT, UDP, WS, Vision).
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

    @Value("${MQTT_PORT:1883}")
    private String mqttPort;

    @Value("${UDP_PORT:8884}")
    private String udpPort;

    @Value("${MQTT_API_PORT:8007}")
    private String mqttApiPort;

    @Value("${MQTT_SIGNATURE_KEY:SecureEspMqttKey2026}")
    private String mqttSignatureKey;

    @Value("${MANAGER_API_SECRET:19252d23-9d4b-4215-93e7-f81f26c0e11d}")
    private String managerApiSecret;

    @Value("${VOICEPRINT_KEY:7a8b9c0d-1e2f-4a5b-8c9d-0e1f2a3b4c5d}")
    private String voiceprintKey;

    @Value("${WS_PORT:18000}")
    private String wsPort;

    @Value("${VISION_PORT:18003}")
    private String visionPort;

    public void seedParams() {
        String cleanHost = cleanDomain(serverDomain);
        log.info("Checking and auto-seeding system parameters (Domain: {}, Public IP: {})...", cleanHost, mqttPublicIp);

        // 1. Frontend URL (Web UI domain)
        String domainUrl = "https://" + cleanHost;
        checkAndSet("server.fronted_url", domainUrl, "Control panel URL displayed when sending 6-digit verification code", false);

        // 2. OTA Address (Web UI domain)
        checkAndSet("server.ota", domainUrl, "OTA Server Address", false);

        // 3. WebSocket Address (Direct Public IP with Port 18000 + WSS Domain fallback)
        String wsUrl = "ws://" + mqttPublicIp + ":" + wsPort + "/xiaozhi/v1/;wss://" + cleanHost + "/ws";
        checkAndSet("server.websocket", wsUrl, "WebSocket addresses, separated by semicolon", false);

        // 4. MQTT Gateway (Direct Public IP with Port 1883 for ESP32 devices)
        String mqttGateway = mqttPublicIp + ":" + mqttPort;
        checkAndSet("server.mqtt_gateway", mqttGateway, "MQTT gateway configuration", true);

        // 5. UDP Gateway (Direct Public IP with Port 8884 for ESP32 devices)
        String udpGateway = mqttPublicIp + ":" + udpPort;
        checkAndSet("server.udp_gateway", udpGateway, "UDP gateway configuration", true);

        // 6. MQTT Signature Key
        checkAndSet("server.mqtt_signature_key", mqttSignatureKey, "MQTT Secret Key Configuration", true);

        // 7. MQTT Manager API (Docker internal communication)
        String mqttApi = "xiaozhi-esp32-server-mqtt:" + mqttApiPort;
        checkAndSet("server.mqtt_manager_api", mqttApi, "MQTT gateway management API address", false);

        // 8. Server Secret
        if (StringUtils.isNotBlank(managerApiSecret)) {
            checkAndSet("server.secret", managerApiSecret, "Server Secret Key", false);
        }

        // 9. Voiceprint Endpoint
        String voiceprintUrl = "http://xiaozhi-esp32-server-voiceprint:8005/voiceprint/health?key=" + voiceprintKey;
        checkAndSet("server.voice_print", voiceprintUrl, "Voiceprint API address", false);

        // 10. Voiceprint Similarity Threshold
        checkAndSet("server.voiceprint_similarity_threshold", "0.4", "Voiceprint similarity threshold", false);

        // 11. Vision Explain URL (Direct Public IP with Port 18003)
        String visionExplainUrl = "http://" + mqttPublicIp + ":" + visionPort + "/mcp/vision/explain";
        checkAndSet("server.vision_explain", visionExplainUrl, "Vision analysis interface URL sent to device", true);

        // 12. MCP Endpoint (Direct Public IP with Port 18003)
        String mcpEndpointUrl = "http://" + mqttPublicIp + ":" + visionPort + "/mcp/";
        checkAndSet("server.mcp_endpoint", mcpEndpointUrl, "MCP Endpoint Address", true);

        // 13. Server Name
        checkAndSet("server.name", "Xiaozhi AI Server", "System Name", false);

        // 14. Server Auth Enabled
        checkAndSet("server.auth.enabled", "true", "Whether server module enables token authentication", false);

        log.info("System parameters auto-seeding finished.");
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

    private String cleanDomain(String domain) {
        if (StringUtils.isBlank(domain)) {
            return "esp.czbd.app";
        }
        return domain.trim().replaceAll("^https?://", "").replaceAll("/.*$", "");
    }
}
