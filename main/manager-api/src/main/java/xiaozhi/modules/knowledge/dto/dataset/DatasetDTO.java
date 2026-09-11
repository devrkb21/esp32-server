package xiaozhi.modules.knowledge.dto.dataset;

import lombok.*;
import io.swagger.v3.oas.annotations.media.Schema;
import java.io.Serializable;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.*;

/**
 * Knowledge base managementAggregate DTO
 * <p>
 * ContainerClass，Contains all requests for knowledge base module/Static inner class definition of response object。
 * </p>
 */
@Schema(description = "Knowledge base managementAggregate DTO")
@JsonIgnoreProperties(ignoreUnknown = true)
public class DatasetDTO {

    // ========== PassuseInnerPartClass ==========

    /**
     * ParsingParserConfig
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "ParsingParserConfig")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ParserConfig implements Serializable {

        @Schema(description = "Chunking token Count", example = "128")
        @JsonProperty("chunk_token_num")
        private Integer chunkTokenNum;

        @Schema(description = "Delimiterchar", example = "\\n!?;。；！？")
        private String delimiter;

        @Schema(description = "LayoutRecognitionModel: DeepDOC / Simple", example = "DeepDOC")
        @JsonProperty("layout_recognize")
        private String layoutRecognize;

        @Schema(description = "WhetherWill Excel TransferFor HTML", example = "false")
        private Boolean html4excel;

        @Schema(description = "AutomaticGenerateKeywordCount (0 RepresentsClose)", example = "0")
        @JsonProperty("auto_keywords")
        private Integer autoKeywords;

        @Schema(description = "AutomaticGenerateQuestionCount (0 RepresentsClose)", example = "0")
        @JsonProperty("auto_questions")
        private Integer autoQuestions;
    }

    // ========== RequestClass ==========

    /**
     * Create knowledge baseRequest (MapInterface 1: create)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "Create knowledge baseRequest")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CreateReq implements Serializable {

        @NotBlank(message = "Knowledge base name cannot be empty")
        @Schema(description = "Knowledge base name", requiredMode = Schema.RequiredMode.REQUIRED, example = "my_dataset")
        private String name;

        @Schema(description = "Knowledge baseAvatar (Base64 Code)", example = "")
        private String avatar;

        @Schema(description = "Knowledge base description", example = "Used forStorageProductDocument")
        private String description;

        @Schema(description = "EmbeddingModel name", example = "BAAI/bge-large-zh-v1.5")
        @JsonProperty("embedding_model")
        private String embeddingModel;

        @Schema(description = "PermissionSet: me / team", example = "me")
        private String permission;

        @Schema(description = "Chunking method: naive / manual / qa / table / paper / book / laws / presentation / picture / one / knowledge_graph / email", example = "naive")
        @JsonProperty("chunk_method")
        private String chunkMethod;

        @Schema(description = "ParsingParserConfig")
        @JsonProperty("parser_config")
        private ParserConfig parserConfig;
    }

    /**
     * Update knowledge baseRequest (MapInterface 4: update)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "Update knowledge baseRequest")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UpdateReq implements Serializable {

        @Schema(description = "Knowledge base name", example = "updated_dataset")
        private String name;

        @Schema(description = "Knowledge baseAvatar (Base64 Code)", example = "")
        private String avatar;

        @Schema(description = "Knowledge base description", example = "UpdateAfterDescription")
        private String description;

        @Schema(description = "PermissionSet: me / team", example = "team")
        private String permission;

        @Schema(description = "EmbeddingModel name", example = "BAAI/bge-large-zh-v1.5")
        @JsonProperty("embedding_model")
        private String embeddingModel;

        @Schema(description = "Chunking method: naive / manual / qa / table / paper / book / laws / presentation / picture / one / knowledge_graph / email", example = "naive")
        @JsonProperty("chunk_method")
        private String chunkMethod;

        @Schema(description = "ParsingParserConfig")
        @JsonProperty("parser_config")
        private ParserConfig parserConfig;

        @JsonInclude(JsonInclude.Include.NON_NULL)
        @Schema(description = "PageRank Weight (0-100)", example = "50")
        private Integer pagerank;
    }

    /**
     * QueryKnowledge base listRequest (MapInterface 3: list_datasets)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "QueryKnowledge base listRequest")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ListReq implements Serializable {

        @Schema(description = "PageCode (From 1 Start)", example = "1")
        private Integer page;

        @Schema(description = "eachPagesamount", example = "30")
        @JsonProperty("page_size")
        private Integer pageSize;

        @Schema(description = "Sort field: create_time / update_time", example = "create_time")
        private String orderby;

        @Schema(description = "WhetherDescending", example = "true")
        private Boolean desc;

        @Schema(description = "byNameFilter (FuzzyMatch)", example = "my_dataset")
        private String name;

        @Schema(description = "byKnowledge base ID Filter", example = "abc123")
        private String id;
    }

    /**
     * Batch delete knowledge basesRequest (MapInterface 2: delete)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "Batch delete knowledge basesRequest")
    public static class BatchIdReq implements Serializable {

        @NotNull(message = "Knowledge base ID list cannot be empty")
        @Size(min = 1, message = "At least one knowledge base ID is required")
        @Schema(description = "Knowledge base ID List", requiredMode = Schema.RequiredMode.REQUIRED, example = "[\"id1\", \"id2\"]")
        private List<String> ids;
    }

    /**
     * Running GraphRAG Request
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "Running GraphRAG Request")
    public static class RunGraphRagReq implements Serializable {

        @Schema(description = "EntityTypeList", example = "[\"person\", \"organization\"]")
        @JsonProperty("entity_types")
        private List<String> entityTypes;

        @Schema(description = "BuildMethod: light / fast / full", example = "light")
        private String method;
    }

    /**
     * Running RAPTOR Request
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "Running RAPTOR Request")
    public static class RunRaptorReq implements Serializable {

        @Schema(description = "MaximumAggregateClassCount", example = "64")
        @JsonProperty("max_cluster")
        private Integer maxCluster;

        @Schema(description = "SelfDefinePrompt word", example = "pleaseSummaryWithDownContent...")
        private String prompt;
    }

    /**
     * AsyncTask ID Response VO (MapInterface 7/8: run_graphrag/run_raptor)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "AsyncTask ID Response")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TaskIdVO implements Serializable {

        @Schema(description = "GraphRAG Task ID", example = "task_uuid_12345678")
        @JsonProperty("graphrag_task_id")
        private String graphragTaskId;

        @Schema(description = "RAPTOR Task ID", example = "task_uuid_87654321")
        @JsonProperty("raptor_task_id")
        private String raptorTaskId;
    }

    // ========== ResponseClass ==========

    /**
     * Knowledge base details VO (MapInterface 1/3 ReturnDataItem)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "Knowledge base details VO")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InfoVO implements Serializable {

        @Schema(description = "Knowledge base ID", example = "abc123")
        private String id;

        @Schema(description = "Knowledge base name", example = "my_dataset")
        private String name;

        @Schema(description = "Knowledge baseAvatar (Base64 Code)", example = "")
        private String avatar;

        @Schema(description = "Tenant ID", example = "tenant_001")
        @JsonProperty("tenant_id")
        private String tenantId;

        @Schema(description = "Knowledge base description", example = "Used forStorageProductDocument")
        private String description;

        @Schema(description = "EmbeddingModel name", example = "BAAI/bge-large-zh-v1.5")
        @JsonProperty("embedding_model")
        private String embeddingModel;

        @Schema(description = "PermissionSet: me / team", example = "me")
        private String permission;

        @Schema(description = "Chunking method", example = "naive")
        @JsonProperty("chunk_method")
        private String chunkMethod;

        @Schema(description = "ParsingParserConfig")
        @JsonProperty("parser_config")
        private ParserConfig parserConfig;

        @Schema(description = "ChunkingTotal count", example = "1024")
        @JsonProperty("chunk_count")
        private Long chunkCount;

        @Schema(description = "DocumentTotal count", example = "50")
        @JsonProperty("document_count")
        private Long documentCount;

        @Schema(description = "Creation time (Timestamp)", example = "1700000000000")
        @JsonProperty("create_time")
        private Long createTime;

        @Schema(description = "Update time (Timestamp)", example = "1700000001000")
        @JsonProperty("update_time")
        private Long updateTime;

        @Schema(description = "Total Token Count", example = "102400")
        @JsonProperty("token_num")
        private Long tokenNum;

        @Schema(description = "CreateDate (Format: yyyy-MM-dd HH:mm:ss)")
        @JsonProperty("create_date")
        private String createDate;

        @Schema(description = "LastUpdateDate (Format: yyyy-MM-dd HH:mm:ss)")
        @JsonProperty("update_date")
        private String updateDate;
    }

    /**
     * BatchOperationResponse VO
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "BatchOperationResponse VO")
    public static class BatchOperationVO implements Serializable {

        @Schema(description = "SucceededOperationCount", example = "5")
        @JsonProperty("success_count")
        private Integer successCount;

        @Schema(description = "ErrorList")
        private List<Object> errors;
    }

    // ========== Knowledge Graph Related ==========

    /**
     * Knowledge graph data VO (mapping interface 5: knowledge_graph)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "Knowledge graph data VO")
    public static class GraphVO implements Serializable {

        @Schema(description = "Graph node list")
        private List<Node> nodes;

        @Schema(description = "Graph edge list")
        private List<Edge> edges;

        @Schema(description = "Mind map data")
        @JsonProperty("mind_map")
        private Map<String, Object> mindMap;

        /**
         * Graph node
         */
        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        @Builder
        @Schema(description = "Graph node")
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class Node implements Serializable {

            @Schema(description = "Node ID", example = "node_001")
            private String id;

            @Schema(description = "NodeTag", example = "Product")
            private String label;

            @Schema(description = "PageRank Value", example = "0.85")
            private Double pagerank;

            @Schema(description = "Node color", example = "#FF5733")
            private String color;

            @Schema(description = "NodeImage URL", example = "https://example.com/icon.png")
            private String img;
        }

        /**
         * Graph edge
         */
        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        @Builder
        @Schema(description = "Graph edge")
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class Edge implements Serializable {

            @Schema(description = "Source node ID", example = "node_001")
            private String source;

            @Schema(description = "Target node ID", example = "node_002")
            private String target;

            @Schema(description = "EdgeWeight", example = "0.75")
            private Double weight;

            @Schema(description = "EdgeTag (RelationshipDescription)", example = "Belongs to")
            private String label;
        }
    }

    // ========== AsyncTaskTrack (GraphRAG/RAPTOR) ==========

    /**
     * AsyncTaskTrack VO (MapInterface 9/10: TaskProgressReturn)
     */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @Schema(description = "AsyncTaskTrack VO")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TaskTraceVO implements Serializable {

        @Schema(description = "Task ID", example = "task_001")
        private String id;

        @Schema(description = "Document ID", example = "doc_001")
        @JsonProperty("doc_id")
        private String docId;

        @Schema(description = "StartPageCode", example = "1")
        @JsonProperty("from_page")
        private Integer fromPage;

        @Schema(description = "End page number", example = "10")
        @JsonProperty("to_page")
        private Integer toPage;

        @Schema(description = "Progress percentage (0.0 - 1.0)", example = "0.75")
        private Double progress;

        @Schema(description = "ProgressMessage", example = "PositiveAtProcessNo. 5 Page...")
        @JsonProperty("progress_msg")
        private String progressMsg;

        @Schema(description = "Creation time (Timestamp)", example = "1700000000000")
        @JsonProperty("create_time")
        private Long createTime;

        @Schema(description = "Update time (Timestamp)", example = "1700000001000")
        @JsonProperty("update_time")
        private Long updateTime;
    }
}
