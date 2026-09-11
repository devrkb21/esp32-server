package xiaozhi.modules.device.controller;

import java.nio.charset.StandardCharsets;

import org.apache.commons.lang3.StringUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.swagger.v3.oas.annotations.Hidden;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.constant.Constant;
import xiaozhi.modules.device.dto.DeviceReportReqDTO;
import xiaozhi.modules.device.dto.DeviceReportRespDTO;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.sys.service.SysParamsService;

@Tag(name = "Device management", description = "OTA Related interfaces")
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/ota/")
public class OTAController {
    private final DeviceService deviceService;
    private final SysParamsService sysParamsService;

    @Operation(summary = "OTAVersion and device activation status check")
    @PostMapping
    public ResponseEntity<String> checkOTAVersion(
            @RequestBody(required = false) DeviceReportReqDTO deviceReportReqDTO,
            @Parameter(name = "Device-Id", description = "Device Unique identifier", required = false, in = ParameterIn.HEADER) @RequestHeader(value = "Device-Id", required = false) String deviceId,
            @Parameter(name = "Client-Id", description = "Client Identifier", required = false, in = ParameterIn.HEADER) @RequestHeader(value = "Client-Id", required = false) String clientId) {
        
        // Fallback: if Device-Id header missing, check request body
        if (StringUtils.isBlank(deviceId) && deviceReportReqDTO != null) {
            deviceId = deviceReportReqDTO.getMacAddress();
            if (StringUtils.isBlank(deviceId)) {
                deviceId = deviceReportReqDTO.getUuid();
            }
        }
        
        if (StringUtils.isBlank(deviceId)) {
            return createResponse(DeviceReportRespDTO.createError("Device ID is required"));
        }
        
        boolean macAddressValid = isMacAddressValid(deviceId);
        if (!macAddressValid) {
            return createResponse(DeviceReportRespDTO.createError("Invalid device ID"));
        }
        
        String normalizedDeviceId = normalizeMacAddress(deviceId);
        if (StringUtils.isBlank(clientId)) {
            clientId = normalizedDeviceId;
        }
        
        return createResponse(deviceService.checkDeviceActive(normalizedDeviceId, clientId, deviceReportReqDTO));
    }

    @Operation(summary = "Quick check for device activation status")
    @PostMapping("activate")
    public ResponseEntity<String> activateDevice(
            @Parameter(name = "Device-Id", description = "Device Unique identifier", required = false, in = ParameterIn.HEADER) @RequestHeader(value = "Device-Id", required = false) String deviceId,
            @Parameter(name = "Client-Id", description = "Client Identifier", required = false, in = ParameterIn.HEADER) @RequestHeader(value = "Client-Id", required = false) String clientId) {
        if (StringUtils.isBlank(deviceId)) {
            return ResponseEntity.status(202).build();
        }
        String normalizedDeviceId = normalizeMacAddress(deviceId);
        DeviceEntity device = deviceService.getDeviceByMacAddress(normalizedDeviceId);
        if (device == null) {
            return ResponseEntity.status(202).build();
        }
        return ResponseEntity.ok("success");
    }

    @GetMapping
    @Hidden
    public ResponseEntity<String> getOTA() {
        String mqttUdpConfig = sysParamsService.getValue(Constant.SERVER_MQTT_GATEWAY, false);
        if (StringUtils.isBlank(mqttUdpConfig)) {
            return ResponseEntity.ok("OTA status: Missing mqtt_gateway configuration in parameter management (server.mqtt_gateway)");
        }
        String wsUrl = sysParamsService.getValue(Constant.SERVER_WEBSOCKET, true);
        if (StringUtils.isBlank(wsUrl) || wsUrl.equals("null")) {
            return ResponseEntity.ok("OTA status: Missing WebSocket address in parameter management (server.websocket)");
        }
        String otaUrl = sysParamsService.getValue(Constant.SERVER_OTA, true);
        if (StringUtils.isBlank(otaUrl) || otaUrl.equals("null")) {
            return ResponseEntity.ok("OTA status: Missing OTA address in parameter management (server.ota)");
        }
        return ResponseEntity.ok("OTA status: Running normally, WebSocket cluster count: " + wsUrl.split(";").length);
    }

    @SneakyThrows
    private ResponseEntity<String> createResponse(DeviceReportRespDTO deviceReportRespDTO) {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
        String json = objectMapper.writeValueAsString(deviceReportRespDTO);
        byte[] jsonBytes = json.getBytes(StandardCharsets.UTF_8);
        return ResponseEntity
                .ok()
                .contentType(MediaType.APPLICATION_JSON)
                .contentLength(jsonBytes.length)
                .body(json);
    }

    /**
     * Determine whether MAC address or device ID is valid.
     * Supports colon-separated (AA:BB:CC:DD:EE:FF), hyphen-separated (AA-BB-CC-DD-EE-FF),
     * or raw 12-character hex (AABBCCDDEEFF).
     */
    public static boolean isMacAddressValid(String macAddress) {
        if (StringUtils.isBlank(macAddress)) {
            return false;
        }
        String clean = macAddress.trim();
        // 1. Standard colon or hyphen delimited: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
        String delimitedPattern = "^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$";
        if (clean.matches(delimitedPattern)) {
            return true;
        }
        // 2. Raw 12-char hex: AABBCCDDEEFF or aabbccddeeff
        String rawPattern = "^[0-9A-Fa-f]{12}$";
        if (clean.matches(rawPattern)) {
            return true;
        }
        // 3. Fallback for UUIDs or custom ESP32 client IDs (alphanumeric with hyphens/colons)
        return clean.length() >= 6 && clean.matches("^[0-9A-Za-z:_-]{6,64}$");
    }

    /**
     * Normalize MAC address to uppercase colon-delimited format (AA:BB:CC:DD:EE:FF).
     */
    public static String normalizeMacAddress(String macAddress) {
        if (StringUtils.isBlank(macAddress)) {
            return macAddress;
        }
        String clean = macAddress.trim().replaceAll("[:-]", "").toUpperCase();
        if (clean.matches("^[0-9A-F]{12}$")) {
            StringBuilder sb = new StringBuilder(17);
            for (int i = 0; i < 12; i += 2) {
                if (i > 0) sb.append(':');
                sb.append(clean, i, i + 2);
            }
            return sb.toString();
        }
        return macAddress.trim().toUpperCase();
    }
}
