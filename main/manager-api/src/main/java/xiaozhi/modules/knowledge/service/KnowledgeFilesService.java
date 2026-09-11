package xiaozhi.modules.knowledge.service;

import java.util.List;
import java.util.Map;

import org.springframework.web.multipart.MultipartFile;

import xiaozhi.common.page.PageData;
import xiaozhi.modules.knowledge.dto.KnowledgeFilesDTO;
import xiaozhi.modules.knowledge.dto.document.ChunkDTO;
import xiaozhi.modules.knowledge.dto.document.RetrievalDTO;
import xiaozhi.modules.knowledge.dto.document.DocumentDTO;

/**
 * Knowledge baseDocumentService interface
 */
public interface KnowledgeFilesService {

        /**
         * Paginate query document list
         * 
         * @param knowledgeFilesDTO QueryCondition
         * @param page              PageCode
         * @param limit             eachPagesamount
         * @return Pagination data
         */
        PageData<KnowledgeFilesDTO> getPageList(KnowledgeFilesDTO knowledgeFilesDTO, Integer page, Integer limit);

        /**
         * According toDocumentIDAndKnowledge base IDGetDocument details
         * 
         * @param documentId DocumentID
         * @param datasetId  Knowledge base ID
         * @return Document details (StrongType InfoVO)
         */
        DocumentDTO.InfoVO getByDocumentId(String documentId, String datasetId);

        /**
         * Upload document to knowledge base
         * 
         * @param datasetId    Knowledge base ID
         * @param file         UploadFile
         * @param name         DocumentName
         * @param metaFields   MetadataField
         * @param chunkMethod  Chunking method
         * @param parserConfig ParsingParserConfig
         * @return UploadDocumentInfo
         */
        KnowledgeFilesDTO uploadDocument(String datasetId, MultipartFile file, String name,
                        Map<String, Object> metaFields, String chunkMethod,
                        Map<String, Object> parserConfig);

        /**
         * Batch delete documents
         * 
         * @param datasetId Knowledge base ID
         * @param req       DeleteRequestParameter (ContainDocumentIDList)
         */
        void deleteDocuments(String datasetId, DocumentDTO.BatchIdReq req);

        /**
         * GetRAGConfigInfo
         * 
         * @param ragModelId RAGModel configurationID
         * @return RAGConfigInfo
         */
        Map<String, Object> getRAGConfig(String ragModelId);

        /**
         * Parse document (chunking)
         * 
         * @param datasetId   Knowledge base ID
         * @param documentIds DocumentIDList
         * @return ParsingResult
         */
        boolean parseDocuments(String datasetId, List<String> documentIds);

        /**
         * List chunks of specified document
         * 
         * @param datasetId  Knowledge base ID
         * @param documentId DocumentID
         * @param req        Chunk listRequestParameter
         * @return Chunk listInfo
         */
        ChunkDTO.ListVO listChunks(String datasetId, String documentId, ChunkDTO.ListReq req);

        /**
         * Recall test
         * 
         * @param req Retrieval testRequestParameter
         * @return Recall testResult
         */
        RetrievalDTO.ResultVO retrievalTest(RetrievalDTO.TestReq req);

        /**
         * SaveDocumentShadow record
         */
        boolean saveDocumentShadow(String datasetId, KnowledgeFilesDTO result, String originalName, String chunkMethod,
                        Map<String, Object> parserConfig);

        /**
         * Batch delete document shadow records and synchronize statistical data
         * 
         * @param documentIds DocumentIDList
         * @param datasetId   DatasetID
         * @param chunkDelta  pendingDeductreduceTotalChunkingCount
         * @param tokenDelta  pendingDeductreduceTotalTokenCount
         */
        void deleteDocumentShadows(List<String> documentIds, String datasetId, Long chunkDelta, Long tokenDelta);

        /**
         * According toDatasetIDCleanAllAssociateDocument (CascadeDeletespecialuse)
         * 
         * @param datasetId DatasetID
         */
        void deleteDocumentsByDatasetId(String datasetId);

        /**
         * SyncAllProcessAt RUNNING StatusDocument (provideScheduledTaskInvoke)
         */
        void syncRunningDocuments();

        /**
         * FromRAGFlowFull sync documents to local shadow table
         * Pull all remote documents, compare with local shadow table, and insert missing records
         *
         * @param datasetId DatasetID
         * @return NewSyncDocumentCount
         */
        int syncDocumentsFromRAG(String datasetId);
}