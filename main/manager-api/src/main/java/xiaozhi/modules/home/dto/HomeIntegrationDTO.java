package xiaozhi.modules.home.dto;

import lombok.Data;

/**
 * Smart-home settings as the apps send them. A secret (haToken, mqttPassword) is only sent when
 * the owner typed a new one; blank keeps the saved one, clear* removes it.
 */
@Data
public class HomeIntegrationDTO {
    private String haBaseUrl;
    private String haToken;
    private Boolean clearHaToken;
    private String mqttHost;
    private Integer mqttPort;
    private String mqttUsername;
    private String mqttPassword;
    private Boolean clearMqttPassword;
    private Boolean mqttTls;
}
