package xiaozhi.modules.knowledge.rag;

import java.util.List;
import java.util.Map;

import xiaozhi.modules.knowledge.dto.dataset.DatasetDTO;

import xiaozhi.common.page.PageData;
import xiaozhi.modules.knowledge.dto.KnowledgeFilesDTO;
import xiaozhi.modules.knowledge.dto.document.DocumentDTO;
import xiaozhi.modules.knowledge.dto.document.ChunkDTO;
import xiaozhi.modules.knowledge.dto.document.RetrievalDTO;
import java.util.function.Consumer;

/**
 * Knowledge base API adapter abstract base class
 * Define general knowledge base operation interface，SupportMultipleAftersideAPIImplementation
 */
public abstract class KnowledgeBaseAdapter {

        /**
         * GetAdapter typeIdentifier
         * 
         * @return Adapter type（e.g., ragflow, milvus, pineconeEtc）
         */
        public abstract String getAdapterType();

        /**
         * InitializeAdapterConfig
         * 
         * @param config ConfigParameter
         */
        public abstract void initialize(Map<String, Object> config);

        /**
         * VerifyConfigWhether valid
         * 
         * @param config ConfigParameter
         * @return Verification result
         */
        public abstract boolean validateConfig(Map<String, Object> config);

        /**
         * Paginate query document list
         * 
         * @param datasetId   Knowledge base ID
         * @param queryParams QueryParameter
         * @param page        PageCode
         * @param limit       eachPagesamount
         * @return Pagination data
         */
        public abstract PageData<KnowledgeFilesDTO> getDocumentList(String datasetId,
                        DocumentDTO.ListReq req);

        /**
         * According toDocumentIDGetDocument details
         * 
         * @param datasetId  Knowledge base ID
         * @param documentId DocumentID
         * @return Document details (StrongType InfoVO)
         */
        public abstract DocumentDTO.InfoVO getDocumentById(String datasetId, String documentId);

        /**
         * Upload document to knowledge base
         * 
         * @param req UploadRequestParameter
         * @return UploadDocumentInfo
         */
        public abstract KnowledgeFilesDTO uploadDocument(DocumentDTO.UploadReq req);

        /**
         * Paginate query document list by status
         * 
         * @param datasetId Knowledge base ID
         * @param status    Document parsingStatus
         * @param page      PageCode
         * @param limit     eachPagesamount
         * @return Pagination data
         */
        public abstract PageData<KnowledgeFilesDTO> getDocumentListByStatus(String datasetId,
                        Integer status,
                        Integer page,
                        Integer limit);

        /**
         * DeleteDocument (SupportBatch delete)
         * 
         * @param datasetId Knowledge base ID
         * @param req       ContainDocumentIDListRequestObject
         */
        public abstract void deleteDocument(String datasetId, DocumentDTO.BatchIdReq req);

        /**
         * Parse document (chunking)
         * 
         * @param datasetId   Knowledge base ID
         * @param documentIds DocumentIDList
         * @return ParsingResult
         */
        public abstract boolean parseDocuments(String datasetId, List<String> documentIds);

        /**
         * List chunks of specified document
         * 
         * @param datasetId  Knowledge base ID
         * @param documentId DocumentID
         * @param req        ListRequestParameter (Pagination、KeywordEtc)
         * @return Chunk listVO
         */
        public abstract ChunkDTO.ListVO listChunks(String datasetId,
                        String documentId,
                        ChunkDTO.ListReq req);

        /**
         * Recall test - Retrieve relevant chunks from knowledge base
         * 
         * @param req Retrieval testRequestParameter
         * @return Recall testResult
         */
        public abstract RetrievalDTO.ResultVO retrievalTest(
                        RetrievalDTO.TestReq req);

        /**
         * TestConnection
         * 
         * @return ConnectionTestResult
         */
        public abstract boolean testConnection();

        /**
         * GetAdapterStatusInfo
         * 
         * @return StatusInfo
         */
        public abstract Map<String, Object> getStatus();

        /**
         * GetSupportConfigParameter
         * 
         * @return ConfigParameterDescription
         */
        public abstract Map<String, Object> getSupportedConfig();

        /**
         * GetDefaultConfig
         * 
         * @return DefaultConfig
         */
        public abstract Map<String, Object> getDefaultConfig();

        /**
         * CreateDataset
         * 
         * @param req CreateParameter
         * @return Dataset details
         */
        public abstract DatasetDTO.InfoVO createDataset(DatasetDTO.CreateReq req);

        /**
         * UpdateDataset
         * 
         * @param datasetId DatasetID
         * @param req       UpdateParameter
         * @return Dataset details
         */
        public abstract DatasetDTO.InfoVO updateDataset(String datasetId, DatasetDTO.UpdateReq req);

        /**
         * DeleteDataset
         * 
         * @param req DeleteRequestParameter（ContainIDList）
         * @return BatchOperationResult
         */
        public abstract DatasetDTO.BatchOperationVO deleteDataset(DatasetDTO.BatchIdReq req);

        /**
         * Get dataset document count
         *
         * @param datasetId DatasetID
         * @return DocumentCount
         */
        public abstract Integer getDocumentCount(String datasetId);

        /**
         * GetDatasetCompleteInfo（Name、Introduction、DocumentCountEtc）
         * Used forDetect RAGFlow sideWhetherDeleted、SyncName/IntroductionChange
         *
         * @param datasetId DatasetID
         * @return Dataset details，If RAGFlow sideDoes not existThenReturn null
         */
        public abstract DatasetDTO.InfoVO getDatasetInfo(String datasetId);

        /**
         * SendStreamingRequest (SSE)
         * 
         * @param endpoint APIsidePoint
         * @param body     RequestAgent
         * @param onData   DataCallback
         */
        public abstract void postStream(String endpoint, Object body, Consumer<String> onData);

        /**
         * SearchBot promptQuestion
         *
         * @param config RAGConfig
         * @param body   RequestAgent
         * @param onData DataCallback
         * @return ResponseObject
         */
        public abstract Object postSearchBotAsk(Map<String, Object> config, Object body,
                        Consumer<String> onData);

        /**
         * AgentBot Tovoice
         *
         * @param config  RAGConfig
         * @param agentId Agent ID
         * @param body    RequestAgent
         * @param onData  DataCallback
         */
        public abstract void postAgentBotCompletion(Map<String, Object> config, String agentId, Object body,
                        Consumer<String> onData);
}