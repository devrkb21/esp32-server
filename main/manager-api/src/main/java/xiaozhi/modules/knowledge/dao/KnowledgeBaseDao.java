package xiaozhi.modules.knowledge.dao;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.knowledge.entity.KnowledgeBaseEntity;

/**
 * Knowledge baseKnowledge base
 */
@Mapper
public interface KnowledgeBaseDao extends BaseDao<KnowledgeBaseEntity> {

    /**
     * According toKnowledge base IDDelete related plugin mapping records
     * 
     * @param knowledgeBaseId Knowledge base ID
     */
    void deletePluginMappingByKnowledgeBaseId(@Param("knowledgeBaseId") String knowledgeBaseId);

    /**
     * Atomically update knowledge base statistics on general dimensions
     * 
     * @param datasetId  DatasetID
     * @param docDelta   DocumentCountIncrement
     * @param chunkDelta ChunkingCountIncrement
     * @param tokenDelta TokenCountIncrement
     */
    void updateStatsAfterChange(@Param("datasetId") String datasetId,
            @Param("docDelta") Integer docDelta,
            @Param("chunkDelta") Long chunkDelta,
            @Param("tokenDelta") Long tokenDelta);

}