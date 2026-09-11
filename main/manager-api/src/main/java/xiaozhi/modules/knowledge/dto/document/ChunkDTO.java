package xiaozhi.modules.knowledge.dto.document;

import lombok.*;
import io.swagger.v3.oas.annotations.media.Schema;
import java.io.Serializable;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;

/**
 * Chunk managementAggregate DTO
 */
@Schema(description = "Chunk managementAggregate DTO")
@JsonIgnoreProperties(ignoreUnknown = true)
public class ChunkDTO {

    /**
     * NewaddChunkRequestParameter
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "NewaddChunkRequestParameter")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AddReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Chunk content", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank(message = "Chunk content cannot be empty")
        private String content;

        @Schema(description = "reneedKeywordList")
        @JsonProperty("important_keywords")
        private List<String> importantKeywords;

        @Schema(description = "Preset question list")
        private List<String> questions;
    }

    /**
     * UpdateChunkRequestParameter
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "UpdateChunkRequestParameter")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UpdateReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "NewChunk content")
        private String content;

        @Schema(description = "UpdateKeywordList (CoveroriginalHaveList)")
        @JsonProperty("important_keywords")
        private List<String> importantKeywords;

        @Schema(description = "Enabled/Disabled (true: Enabled, false: Disabled)")
        private Boolean available;
    }

    /**
     * Get chunk list request parameters
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Get chunk list request parameters")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ListReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "PageCode (Default 1)")
        private Integer page;

        @Schema(description = "eachPagesamount (Default 30)")
        @JsonProperty("page_size")
        private Integer pageSize;

        @Schema(description = "SearchKeyword (AlldocRetrieval)")
        private String keywords;

        @Schema(description = "ExactChunk ID")
        private String id;
    }

    /**
     * Batch deleteChunkRequestParameter
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Batch deleteChunkRequestParameter")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class RemoveReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Chunk ID List", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("chunk_ids")
        @NotEmpty(message = "Chunk ID list cannot be empty")
        private List<String> chunkIds;
    }

    /**
     * Document chunkInfo VO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Document chunkInfo")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InfoVO implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Chunk ID (UsuallyFor document_id + Index)", requiredMode = Schema.RequiredMode.REQUIRED)
        private String id;

        @Schema(description = "ChunkTextContent (AlldocRetrievalPrimaryneedObject)", requiredMode = Schema.RequiredMode.REQUIRED)
        private String content;

        @Schema(description = "BelongingDocument ID", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("document_id")
        private String documentId;

        @Schema(description = "DocumentName / Keyword")
        @JsonProperty("docnm_kwd")
        private String docnmKwd;

        @Schema(description = "reneedKeywordList (Used forKeywordEnhanceRetrieval)")
        @JsonProperty("important_keywords")
        private List<String> importantKeywords;

        @Schema(description = "Preset question list (Used for Q&A ModeEnhance)")
        private List<String> questions;

        @Schema(description = "AssociateImage ID")
        @JsonProperty("image_id")
        private String imageId;

        @Schema(description = "BelongingKnowledge base ID")
        @JsonProperty("dataset_id")
        private String datasetId;

        @Schema(description = "ChunkWhetherAvailable (true: ParameterWithRetrieval, false: BeDisabled)")
        private Boolean available;

        @Schema(description = "Position index list of chunks in original text (RAGFlowReturnNestedArray, Like [[start, end, filename]])")
        private List<List<Object>> positions;

        @Schema(description = "Token ID List")
        @JsonProperty("token")
        private List<Integer> token;
    }

    /**
     * ShardingListAggregateResponse
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "ShardingListAggregateResponse")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ListVO implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "ChunkInfoList")
        private List<InfoVO> chunks;

        @Schema(description = "AssociateDocumentDetailedInfo")
        private DocumentDTO.InfoVO doc;

        @Schema(description = "Total records")
        private Long total;
    }
}
