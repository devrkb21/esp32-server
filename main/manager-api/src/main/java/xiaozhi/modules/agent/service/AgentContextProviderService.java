package xiaozhi.modules.agent.service;

import xiaozhi.common.service.BaseService;
import xiaozhi.modules.agent.entity.AgentContextProviderEntity;

public interface AgentContextProviderService extends BaseService<AgentContextProviderEntity> {
    /**
     * According toAgentIDGet context source configuration
     * @param agentId AgentID
     * @return Context providerConfigurationEntity
     */
    AgentContextProviderEntity getByAgentId(String agentId);

    /**
     * Save or update context source configuration
     * @param entity Entity
     */
    void saveOrUpdateByAgentId(AgentContextProviderEntity entity);

    /**
     * According toAgentIDDeleteContext providerConfiguration
     * @param agentId AgentID
     */
    void deleteByAgentId(String agentId);
}
