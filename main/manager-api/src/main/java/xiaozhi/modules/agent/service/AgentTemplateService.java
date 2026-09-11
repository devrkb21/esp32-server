package xiaozhi.modules.agent.service;

import com.baomidou.mybatisplus.extension.repository.IRepository;

import xiaozhi.modules.agent.entity.AgentTemplateEntity;

/**
 * @author chenerlei
 * @description forfortable【ai_agent_template(Agent configurationTemplatetable)】DatalibOperationService
 * @createDate 2025-03-22 11:48:18
 */
public interface AgentTemplateService extends IRepository<AgentTemplateEntity> {

    /**
     * GetDefaultTemplate
     * 
     * @return DefaultTemplateEntity
     */
    AgentTemplateEntity getDefaultTemplate();

    /**
     * UpdateDefaultTemplateinModelID
     * 
     * @param modelType Model type
     * @param modelId   ModelID
     */
    void updateDefaultTemplateModelId(String modelType, String modelId);

    /**
     * Reorder remaining templates after deleting template
     * 
     * @param deletedSort byDeleteTemplateSortValue
     */
    void reorderTemplatesAfterDelete(Integer deletedSort);

    /**
     * Get next available sorting sequence number（Find minimumnotUseSequence）
     * 
     * @return underOneAvailableSortSequence
     */
    Integer getNextAvailableSort();
}
