package xiaozhi.modules.device.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Data
@Schema(description = "DeviceOTADetect versionReturnAgent，ContainActivateCodeneedrequest")
public class DeviceReportRespDTO {
    @Schema(description = "Server time")
    private ServerTime server_time;

    @Schema(description = "ActivateCode")
    private Activation activation;

    @Schema(description = "ErrorInformation")
    private String error;

    @Schema(description = "Firmware versionInformation")
    private Firmware firmware;

    @Schema(description = "WebSocketConfiguration")
    private Websocket websocket;

    @Schema(description = "MQTT GatewayConfiguration")
    private MQTT mqtt;

    @Schema(description = "Companion API (xiaozhi-server's HTTP port) the robot calls for its day, alarms and messages")
    private Companion companion;

    @Getter
    @Setter
    public static class Companion {
        @Schema(description = "Base URL without trailing slash, e.g. http://192.168.0.123:8003")
        private String url;
    }

    @Getter
    @Setter
    public static class Firmware {
        @Schema(description = "Version number")
        private String version;
        @Schema(description = "DownloadAddress")
        private String url;
    }

    public static DeviceReportRespDTO createError(String message) {
        DeviceReportRespDTO resp = new DeviceReportRespDTO();
        resp.setError(message);
        return resp;
    }

    @Setter
    @Getter
    public static class Activation {
        @Schema(description = "ActivateCode")
        private String code;

        @Schema(description = "ActivateCodeInformation: ActivateAddress")
        private String message;

        @Schema(description = "ChallengeCode")
        private String challenge;

        @Schema(description = "Link URL for the robot's QR: <server.fronted_url>/#/link?code=<code> (null when the control panel URL is not configured)")
        private String url;
    }

    @Getter
    @Setter
    public static class ServerTime {
        @Schema(description = "Timestamp")
        private Long timestamp;

        @Schema(description = "Timezone")
        private String timeZone;

        @Schema(description = "Timezone offset，UnitasMinutes")
        private Integer timezone_offset;
    }

    @Getter
    @Setter
    public static class Websocket {
        @Schema(description = "WebSocketServerAddress")
        private String url;
        @Schema(description = "WebSocket Authentication token")
        private String token;
    }

    @Getter
    @Setter
    public static class MQTT {
        @Schema(description = "MQTT ConfigurationURL")
        private String endpoint;
        @Schema(description = "MQTT ClientUnique identifierchar")
        private String client_id;
        @Schema(description = "MQTT AuthenticationUsername")
        private String username;
        @Schema(description = "MQTT AuthenticationPassword")
        private String password;
        @Schema(description = "ESP32 published message topic")
        private String publish_topic;
        @Schema(description = "ESP32 subscribed topic")
        private String subscribe_topic;
    }
}