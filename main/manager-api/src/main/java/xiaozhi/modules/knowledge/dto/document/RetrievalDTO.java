package xiaozhi.modules.knowledge.dto.document;

import lombok.*;
import io.swagger.v3.oas.annotations.media.Schema;
import java.io.Serializable;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;

/**
 * Aggregation of retrieval and metadata management DTO
 */
@Schema(description = "Aggregation of retrieval and metadata management DTO")
@JsonIgnoreProperties(ignoreUnknown = true)
public class RetrievalDTO {

    /**
     * DocumentAggregateInfo (VO)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "DocumentAggregateInfo")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DocAggVO implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "DocumentName")
        @JsonProperty("doc_name")
        private String docName;

        @Schema(description = "Document ID")
        @JsonProperty("doc_id")
        private String docId;

        @Schema(description = "Count")
        private Integer count;
    }

    /**
     * Retrieval testRequestParameter
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Retrieval testRequestParameter")
    @JsonIgnoreProperties(ignoreUnknown = true)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TestReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Knowledge base ID List", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("dataset_ids")
        @NotEmpty(message = "Knowledge base ID list cannot be empty")
        private List<String> datasetIds;

        @Schema(description = "Document ID List (canSelect，Used forLimitdefineRetrievalRange)")
        @JsonProperty("document_ids")
        private List<String> documentIds;

        @Schema(description = "RetrievalQuestion", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Retrieval query cannot be empty")
        private String question;

        @Schema(description = "PageCode (Default 1)")
        private Integer page;

        @Schema(description = "eachPagesamount (Default 10)")
        @JsonProperty("page_size")
        private Integer pageSize;

        @Schema(description = "Similarity threshold (Default 0.2)")
        @JsonProperty("similarity_threshold")
        private Float similarityThreshold;

        @Schema(description = "VectorSimilarityWeight (Default 0.3)")
        @JsonProperty("vector_similarity_weight")
        private Float vectorSimilarityWeight;

        @Schema(description = "Return Top K Chunk (Default 1024)")
        @JsonProperty("top_k")
        private Integer topK;

        @Schema(description = "RerankingModel ID")
        @JsonProperty("rerank_id")
        private String rerankId;

        @Schema(description = "WhetherHighlightKeyword")
        private Boolean highlight;

        @Schema(description = "WhetherEnabledKeywordRetrieval")
        private Boolean keyword;

        @Schema(description = "CrossLanguageTranslateList (canSelect)")
        @JsonProperty("cross_languages")
        private List<String> crossLanguages;

        @Schema(description = "MetaData filterCondition (JSON Object)")
        @JsonProperty("metadata_condition")
        private Map<String, Object> metadataCondition;
    }

    /**
     * RetrievalHitResult (VO)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "RetrievalHitChunk details")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class HitVO implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Chunk ID", requiredMode = Schema.RequiredMode.REQUIRED)
        private String id;

        @Schema(description = "Chunk content", requiredMode = Schema.RequiredMode.REQUIRED)
        private String content;

        @Schema(description = "BelongingDocument ID", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("document_id")
        private String documentId;

        @Schema(description = "BelongingKnowledge base ID")
        @JsonProperty("dataset_id")
        private String datasetId;

        @Schema(description = "DocumentName")
        @JsonProperty("document_name")
        private String documentName;

        @Schema(description = "DocumentKeyword")
        @JsonProperty("document_keyword")
        private String documentKeyword;

        @Schema(description = "ComprehensiveSimilarity", requiredMode = Schema.RequiredMode.REQUIRED)
        private Float similarity;

        @Schema(description = "VectorSimilarity")
        @JsonProperty("vector_similarity")
        private Float vectorSimilarity;

        @Schema(description = "KeywordSimilarity")
        @JsonProperty("term_similarity")
        private Float termSimilarity;

        @Schema(description = "IndexPosition")
        private Integer index;

        @Schema(description = "HighlightContent")
        private String highlight;

        @Schema(description = "reneedKeywordList")
        @JsonProperty("important_keywords")
        private List<String> importantKeywords;

        @Schema(description = "Preset question list")
        private List<String> questions;

        @Schema(description = "Image ID")
        @JsonProperty("image_id")
        private String imageId;

        @Schema(description = "PositionIndex (RAGFlowReturnNestedArray, Like [[start, end, filename]])")
        private Object positions;
    }

    /**
     * Knowledge baseMetadataSummary (VO)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Knowledge base metadata summary information")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MetaSummaryVO implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "DocumentTotal count", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("total_doc_count")
        private Long totalDocCount;

        @Schema(description = "Token Total count", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("total_token_count")
        private Long totalTokenCount;

        @Schema(description = "FileTypeDistribution (key: FileAfterSuffix, value: Count)")
        @JsonProperty("file_type_distribution")
        private Map<String, Long> fileTypeDistribution;

        @Schema(description = "docStatusDistribution (key: StatusCode, value: Count)")
        @JsonProperty("status_distribution")
        private Map<String, Long> statusDistribution;

        @Schema(description = "SelfDefineMetadataStatistics (key: FieldName, value: Count/Value)")
        @JsonProperty("custom_metadata")
        private Map<String, Object> customMetadata;
    }

    /**
     * Batch update metadata request parameters
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Batch update metadata request parameters")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MetaBatchReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Filter: specifies document range to update (default all)")
        private Selector selector;

        @Schema(description = "List of added or updated metadata")
        private List<UpdateItem> updates;

        @Schema(description = "List of metadata keys to delete")
        private List<DeleteItem> deletes;

        /**
         * Document filter
         */
        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        @Schema(description = "MetadataUpdateFilter")
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class Selector implements Serializable {
            private static final long serialVersionUID = 1L;

            @Schema(description = "SpecifyDocument ID List")
            @JsonProperty("document_ids")
            private List<String> documentIds;

            @Schema(description = "MetadataConditionMatch (key: FieldName, value: MatchValue)")
            @JsonProperty("metadata_condition")
            private Map<String, Object> metadataCondition;
        }

        /**
         * UpdateItem
         */
        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        @Schema(description = "MetadataUpdateItem")
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class UpdateItem implements Serializable {
            private static final long serialVersionUID = 1L;

            @Schema(description = "Metadata keyName", requiredMode = Schema.RequiredMode.REQUIRED)
            private String key;

            @Schema(description = "Metadata value", requiredMode = Schema.RequiredMode.REQUIRED)
            private Object value;
        }

        /**
         * DeleteItem
         */
        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        @Schema(description = "MetadataDeleteItem")
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class DeleteItem implements Serializable {
            private static final long serialVersionUID = 1L;

            @Schema(description = "NeedDeleteMetadata keyName", requiredMode = Schema.RequiredMode.REQUIRED)
            private String key;
        }
    }

    /**
     * Recall testResultAggregateResponse
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Recall testResultAggregateResponse")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ResultVO implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "RetrievalHitChunk list")
        private List<HitVO> chunks;

        @Schema(description = "Document distribution statistics")
        @JsonProperty("doc_aggs")
        private List<DocAggVO> docAggs;

        @Schema(description = "Total hitsMiddleRecordCount")
        private Long total;
    }
}
