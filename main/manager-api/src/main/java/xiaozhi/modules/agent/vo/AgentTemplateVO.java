package xiaozhi.modules.agent.vo;

import lombok.Data;
import lombok.EqualsAndHashCode;
import xiaozhi.modules.agent.entity.AgentTemplateEntity;

@Data
@EqualsAndHashCode(callSuper = true)
public class AgentTemplateVO extends AgentTemplateEntity {
    // RoleVoice timbre
    private String ttsModelName;

    // RoleModel
    private String llmModelName;
}
