package xiaozhi.modules.agent.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import xiaozhi.modules.agent.dto.ContextProviderDTO;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.agent.entity.AgentPluginMapping;

import java.util.List;

/**
 * AgentInformationReturnAgentVO
 * HereDirectlyextendAgentEntityclassAgentEntity，subsequent need to standardize return fields can becopyFieldOut
 */
@EqualsAndHashCode(callSuper = true)
@Data
public class AgentInfoVO extends AgentEntity
{
    @Schema(description = "PluginListId")
    private List<AgentPluginMapping> functions;

    @Schema(description = "Context providerConfiguration")
    private List<ContextProviderDTO> contextProviders;

    @Schema(description = "Replacement word fileIDList")
    private List<String> correctWordFileIds;

    @Schema(description = "CurrentConfigurationVersion number")
    private Integer currentVersionNo;
}
