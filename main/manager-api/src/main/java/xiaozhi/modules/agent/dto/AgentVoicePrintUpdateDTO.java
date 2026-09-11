package xiaozhi.modules.agent.dto;

import lombok.Data;

/**
 * UpdateAgentVoiceprintdto
 *
 * @author zjy
 */
@Data
public class AgentVoicePrintUpdateDTO {
    /**
     * AgentVoiceprintid
     */
    private String id;
    /**
     * Audio fileid
     */
    private String audioId;
    /**
     * VoiceprintSourceuserName
     */
    private String sourceName;
    /**
     * DescriptionVoiceprintSourceuser
     */
    private String introduce;
}
