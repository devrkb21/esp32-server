package xiaozhi.modules.agent.dto;

import java.time.LocalDateTime;

import lombok.Data;

/**
 * AgentSession listDTO
 */
@Data
public class AgentChatSessionDTO {
    /**
     * Session ID
     */
    private String sessionId;

    /**
     * willCall duration
     */
    private LocalDateTime createdAt;

    /**
     * Chat count
     */
    private Integer chatCount;

    /**
     * Session title
     */
    private String title;
}