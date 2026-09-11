package xiaozhi.modules.device.dto;

import lombok.Data;

@Data
public class DeviceManualAddDTO {
    private String agentId;
    private String board;        // DeviceModel
    private String appVersion;   // Firmware version
    private String macAddress;   // MacAddress
} 