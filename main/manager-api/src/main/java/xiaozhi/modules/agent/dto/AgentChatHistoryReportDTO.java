package xiaozhi.modules.agent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * XiaozhiDeviceChat reportRequest
 *
 * @author Haotian
 * @version 1.0, 2025/5/8
 */
@Data
@Schema(description = "XiaozhiDeviceChat reportRequest")
public class AgentChatHistoryReportDTO {
    @Schema(description = "MACAddress", example = "00:11:22:33:44:55")
    @NotBlank
    private String macAddress;
    @Schema(description = "Session ID", example = "79578c31-f1fb-426a-900e-1e934215f05a")
    @NotBlank
    private String sessionId;
    @Schema(description = "Message type: 1-User, 2-Agent", example = "1")
    @NotNull
    private Byte chatType;
    @Schema(description = "ChatContent", example = "Hello there")
    @NotBlank
    private String content;
    @Schema(description = "base64CodeopusAudioData", example = "")
    private String audioBase64;
    @Schema(description = "Reportwhenbetween，Ten digitsTimestamp，emptywhenDefaultUseCurrent time", example = "1745657732")
    private Long reportTime;
}
