package xiaozhi.modules.agent.vo;

import lombok.Data;

import java.util.Date;

/**
 * DisplayAgentVoiceprint listVO
 */
@Data
public class AgentVoicePrintVO {

    /**
     * Primary keyid
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
    /**
     * Creation time
     */
    private Date createDate;
}
