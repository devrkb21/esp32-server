package xiaozhi.modules.agent.dto;

import lombok.Data;

/**
 * SaveAgentVoiceprintdto
 *
 * @author zjy
 */
@Data
public class AgentVoicePrintSaveDTO {
    /**
     * AssociateAgentid
     */
    private String agentId;
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
