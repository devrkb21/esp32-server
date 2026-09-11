package xiaozhi.modules.knowledge.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.knowledge.dto.KnowledgeBaseDTO;
import xiaozhi.modules.knowledge.entity.KnowledgeBaseEntity;
import xiaozhi.modules.model.entity.ModelConfigEntity;

/**
 * Knowledge base service interface
 */
public interface KnowledgeBaseService extends BaseService<KnowledgeBaseEntity> {

    /**
     * Paginate query knowledge base list
     * 
     * @param knowledgeBaseDTO QueryCondition
     * @param page             PageCode
     * @param limit            eachPagesamount
     * @return Pagination data
     */
    PageData<KnowledgeBaseDTO> getPageList(KnowledgeBaseDTO knowledgeBaseDTO, Integer page, Integer limit);

    /**
     * According toIDGetKnowledge base details
     * 
     * @param id Knowledge base ID
     * @return Knowledge base details
     */
    KnowledgeBaseDTO getById(String id);

    /**
     * NewaddKnowledge base
     * 
     * @param knowledgeBaseDTO Knowledge baseInfo
     * @return NewaddKnowledge base
     */
    KnowledgeBaseDTO save(KnowledgeBaseDTO knowledgeBaseDTO);

    /**
     * Update knowledge base
     * 
     * @param knowledgeBaseDTO Knowledge baseInfo
     * @return UpdateKnowledge base
     */
    KnowledgeBaseDTO update(KnowledgeBaseDTO knowledgeBaseDTO);

    /**
     * According toKnowledge base IDQueryKnowledge base
     * 
     * @param datasetId Knowledge base ID
     * @return Knowledge base details
     */
    KnowledgeBaseDTO getByDatasetId(String datasetId);

    /**
     * According toKnowledge base IDCollectionQueryKnowledge base
     *
     * @param datasetIdList Knowledge base IDCollection
     * @return Knowledge base details
     */
    List<KnowledgeBaseDTO> getByDatasetIdList(List<String> datasetIdList);

    /**
     * According toKnowledge base IDDeleteKnowledge base
     * 
     * @param datasetId Knowledge base ID
     */
    void deleteByDatasetId(String datasetId);

    /**
     * GetRAGConfigInfo
     * 
     * @param ragModelId RAGModel configurationID
     * @return RAGConfigInfo
     */
    Map<String, Object> getRAGConfig(String ragModelId);

    /**
     * According toKnowledge base IDGetToshouldRAGConfig
     * 
     * @param datasetId Knowledge base ID
     * @return RAGConfig
     */
    Map<String, Object> getRAGConfigByDatasetId(String datasetId);

    /**
     * Get RAG model list
     * 
     * @return RAGModel list
     */
    List<ModelConfigEntity> getRAGModels();

    /**
     * Update knowledge baseStatisticsInfo (Used forBeFileServiceCallback)
     * 
     * @param datasetId  Knowledge base ID
     * @param docDelta   DocumentCountIncrement
     * @param chunkDelta ChunkingCountIncrement
     * @param tokenDelta TokenCountIncrement
     */
    void updateStatistics(String datasetId, Integer docDelta, Long chunkDelta, Long tokenDelta);
}