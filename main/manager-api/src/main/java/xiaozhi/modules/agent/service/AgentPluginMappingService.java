package xiaozhi.modules.agent.service;

import java.util.List;

import com.baomidou.mybatisplus.extension.repository.IRepository;

import xiaozhi.modules.agent.entity.AgentPluginMapping;

/**
 * @description forfortable【ai_agent_plugin_mapping(AgentandPluginUniqueMappingtable)】DatalibOperationService
 * @createDate 2025-05-25 22:33:17
 */
public interface AgentPluginMappingService extends IRepository<AgentPluginMapping> {

    /**
     * According toAgentidGetPluginParameter
     *
     * @param agentId
     * @return
     */
    List<AgentPluginMapping> agentPluginParamsByAgentId(String agentId);

    /**
     * According toAgentidDeletePluginParameter
     *
     * @param agentId
     */
    void deleteByAgentId(String agentId);

    /**
     * According toPluginIDDelete plugin mappings for all agents
     *
     * @param pluginId PluginID
     */
    void deleteByPluginId(String pluginId);
}
