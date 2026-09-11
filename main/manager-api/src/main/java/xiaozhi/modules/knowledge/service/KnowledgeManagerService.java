package xiaozhi.modules.knowledge.service;

import java.util.List;

/**
 * Knowledge base module domain orchestration service
 * Used to handle complex business processes across KnowledgeBase and KnowledgeFiles, thoroughly resolving circular dependency issues between Services.
 */
public interface KnowledgeManagerService {

    /**
     * Cascade delete knowledge base and all subordinate documents (IncludethisLocal DB And RAGFlow RemoteData)
     * 
     * @param datasetId Knowledge base ID
     */
    void deleteDatasetWithFiles(String datasetId);

    /**
     * BatchCascadeDeleteKnowledge base
     * 
     * @param datasetIds Knowledge base ID List
     */
    void batchDeleteDatasetsWithFiles(List<String> datasetIds);
}
