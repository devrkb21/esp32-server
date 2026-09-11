package xiaozhi.modules.agent.dto;

import java.util.Date;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * AgentChat historyDTO
 */
@Data
@Schema(description = "AgentChat history")
public class AgentChatHistoryDTO {
    @Schema(description = "Creation time")
    private Date createdAt;

    @Schema(description = "Message type: 1-User, 2-Agent")
    private Byte chatType;

    @Schema(description = "ChatContent")
    private String content;

    @Schema(description = "AudioID")
    private String audioId;

    @Schema(description = "MACAddress")
    private String macAddress;
}