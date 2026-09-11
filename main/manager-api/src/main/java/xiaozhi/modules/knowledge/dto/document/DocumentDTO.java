package xiaozhi.modules.knowledge.dto.document;

import lombok.*;
import io.swagger.v3.oas.annotations.media.Schema;
import java.io.Serializable;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.*;

/**
 * Document managementAggregate DTO
 */
@Schema(description = "Document managementAggregate DTO")
@JsonIgnoreProperties(ignoreUnknown = true)
public class DocumentDTO {

    /**
     * UploadDocumentRequestParameter
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "UploadDocumentRequestParameter")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UploadReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Knowledge base ID (MustSpecifyOwnership)", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("dataset_id")
        @NotBlank(message = "Knowledge base ID cannot be empty")
        private String datasetId;

        @Schema(description = "File name (IfSpecify，ThenCoveroriginalOriginal file name)")
        private String name;

        @Schema(description = "Chunking method")
        @JsonProperty("chunk_method")
        private DocumentDTO.InfoVO.ChunkMethod chunkMethod;

        @Schema(description = "ParsingParameter configuration")
        @JsonProperty("parser_config")
        private DocumentDTO.InfoVO.ParserConfig parserConfig;

        @Schema(description = "VirtualFileFolderPath (DefaultFor /)")
        @JsonProperty("parent_path")
        private String parentPath;

        @Schema(description = "MetadataField")
        @JsonProperty("meta")
        private Map<String, Object> metaFields;

        @Schema(description = "File binary stream (supports PDF, DOCX, TXT, MD and multiple formats)", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull(message = "Uploaded file cannot be empty")
        private org.springframework.web.multipart.MultipartFile file;
    }

    /**
     * UpdateDocumentRequestParameter
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "UpdateDocumentRequestParameter")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UpdateReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "NewDocumentName (MustContainFileAfterSuffix，MoreoverNotcanChangeoriginalinitialType)")
        private String name;

        @Schema(description = "Enabled/DisabledStatus (true: Enabled, false: Disabled; DisabledAfterNotParameterWithRetrieval)")
        private Boolean enabled;

        @Schema(description = "NewParsing method (Modifying this resets parsing status)")
        @JsonProperty("chunk_method")
        private InfoVO.ChunkMethod chunkMethod;

        @Schema(description = "New parser detailed configuration (should be paired with chunk_method)")
        @JsonProperty("parser_config")
        private InfoVO.ParserConfig parserConfig;
    }

    /**
     * Get document list request parameters
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Get document list request parameters")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ListReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "PageCode (Default: 1)")
        private Integer page;

        @Schema(description = "eachPagesamount (Default: 30)")
        @JsonProperty("page_size")
        private Integer pageSize;

        @Schema(description = "Sort field (canSelect: create_time, name, size; Default: create_time)")
        private String orderby;

        @Schema(description = "WhetherDescendingArrange (true: MostNew/MaximumAtBefore; false: MostOld/MostsmallAtBefore; Default: true)")
        private Boolean desc;

        @Schema(description = "Exact filter: document ID")
        private String id;

        @Schema(description = "Exact filter: document full name (with extension)")
        private String name;

        @Schema(description = "FuzzySearch: DocumentNameKeyword")
        private String keywords;

        @Schema(description = "Filter: FileAfterSuffixList (Like ['pdf', 'docx'])")
        private List<String> suffix;

        @Schema(description = "Filter: RunningStatusList")
        private List<InfoVO.RunStatus> run;

        @Schema(description = "Filter: StartCreation time (Timestamp, millis)")
        @JsonProperty("create_time_from")
        private Long createTimeFrom;

        @Schema(description = "Filter: EndCreation time (Timestamp, millis)")
        @JsonProperty("create_time_to")
        private Long createTimeTo;
    }

    /**
     * BatchDocumentOperationRequestParameter (Used forDelete、ParsingEtc)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "BatchDocumentOperationRequestParameter")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class BatchIdReq implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Document ID List", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("ids") // For compatibility, document_ids could also be supported, but uniformly named ids here
        @JsonAlias("document_ids")
        @NotEmpty(message = "Document ID list cannot be empty")
        private List<String> ids;
    }

    /**
     * Knowledge baseDocumentInfo VO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Knowledge baseDocumentInfo")
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class InfoVO implements Serializable {
        private static final long serialVersionUID = 1L;

        @Schema(description = "Document ID (Unique identifier)", requiredMode = Schema.RequiredMode.REQUIRED)
        private String id;

        @Schema(description = "Document thumbnail URL (Base64 or Link)")
        private String thumbnail;

        @Schema(description = "BelongingKnowledge base ID", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("dataset_id")
        private String datasetId;

        @Schema(description = "Document parsingMethod (ResolvedefineDocumentLikeAnyBeChunk)")
        @JsonProperty("chunk_method")
        private ChunkMethod chunkMethod;

        @Schema(description = "Associate ETL Pipeline ID (LikeHave)")
        @JsonProperty("pipeline_id")
        private String pipelineId;

        @Schema(description = "Document parsingParserDetailedConfig")
        @JsonProperty("parser_config")
        private ParserConfig parserConfig;

        @Schema(description = "SourceType (Like local, s3, url Etc)")
        @JsonProperty("source_type")
        private String sourceType;

        @Schema(description = "DocumentFileType (Like pdf, docx, txt)", requiredMode = Schema.RequiredMode.REQUIRED)
        private String type;

        @Schema(description = "CreatorUser ID")
        @JsonProperty("created_by")
        private String createdBy;

        @Schema(description = "DocumentName (ContainExtension)", requiredMode = Schema.RequiredMode.REQUIRED)
        private String name;

        @Schema(description = "File storage path or location identifier")
        private String location;

        @Schema(description = "File size (Unit: Bytes)")
        private Long size;

        @Schema(description = "Contain Token Total count (ParsingAfterStatistics)")
        @JsonProperty("token_count")
        private Long tokenCount;

        @Schema(description = "ContainChunk (Chunk) Total count")
        @JsonProperty("chunk_count")
        private Long chunkCount;

        @Schema(description = "ParsingProgress (0.0 ~ 1.0, 1.0 RepresentsComplete)")
        private Double progress;

        @Schema(description = "Current progress description or error message")
        @JsonProperty("progress_msg")
        private String progressMsg;

        @Schema(description = "StartProcessTimestamp (RAGFlowReturnRFC1123Format)")
        @JsonProperty("process_begin_at")
        private String processBeginAt;

        @Schema(description = "ProcessTotal timewhen (Unit: s)")
        @JsonProperty("process_duration")
        private Double processDuration;

        @Schema(description = "SelfDefineMetadataField (Key-Value KeyValueTo)")
        @JsonProperty("meta_fields")
        private Map<String, Object> metaFields;

        @Schema(description = "FileAfterExtension (NotContains dot)")
        private String suffix;

        @Schema(description = "Document parsingRunningStatus")
        private RunStatus run;

        @Schema(description = "DocumentAvailableStatus (1: Enabled/Normal, 0: Disabled/Invalidate)", requiredMode = Schema.RequiredMode.REQUIRED)
        private String status;

        @Schema(description = "Creation time (Timestamp, millis)", requiredMode = Schema.RequiredMode.REQUIRED)
        @JsonProperty("create_time")
        private Long createTime;

        @Schema(description = "CreateDate (RAGFlowReturnRFC1123Format)")
        @JsonProperty("create_date")
        private String createDate;

        @Schema(description = "LastUpdate time (Timestamp, millis)")
        @JsonProperty("update_time")
        private Long updateTime;

        @Schema(description = "LastUpdateDate (RAGFlowReturnRFC1123Format)")
        @JsonProperty("update_date")
        private String updateDate;

        /**
         * Parsing methodEnum (ChunkMethod)
         */
        public enum ChunkMethod {
            @Schema(description = "PassuseMode: Suitable for most plain text or mixed documents")
            @JsonProperty("naive")
            NAIVE,
            @Schema(description = "ManualMode: AllowUserManualEditChunk")
            @JsonProperty("manual")
            MANUAL,
            @Schema(description = "QAMode: specialPortaloptimizeConversion Q&A FormatDocument")
            @JsonProperty("qa")
            QA,
            @Schema(description = "tableGridMode: specialPortaloptimizeConversion Excel Or CSV EtctableGridData")
            @JsonProperty("table")
            TABLE,
            @Schema(description = "PaperMode: Optimized for academic paper layouts")
            @JsonProperty("paper")
            PAPER,
            @Schema(description = "BookMode: Optimized for book chapter structures")
            @JsonProperty("book")
            BOOK,
            @Schema(description = "LawmethodRegulationMode: Optimized for legal article structures")
            @JsonProperty("laws")
            LAWS,
            @Schema(description = "DemodocDraftMode: forTo PPT EtcDemoFileoptimizeConversion")
            @JsonProperty("presentation")
            PRESENTATION,
            @Schema(description = "ImageMode: forToImageContentPerform OCR AndDescription")
            @JsonProperty("picture")
            PICTURE,
            @Schema(description = "WholeAgentMode: Treat entire document as a single chunk")
            @JsonProperty("one")
            ONE,
            @Schema(description = "Knowledge graph mode: extract entity relationships to build graph")
            @JsonProperty("knowledge_graph")
            KNOWLEDGE_GRAPH,
            @Schema(description = "EmailMode: forToEmailFormatoptimizeConversion")
            @JsonProperty("email")
            EMAIL;
        }

        /**
         * RunningStatusEnum (RunStatus)
         */
        public enum RunStatus {
            @Schema(description = "Not yetStart: EtcpendingParsingQueue")
            @JsonProperty("UNSTART")
            UNSTART,
            @Schema(description = "PerformMiddle: PositiveAtParsingOrIndex")
            @JsonProperty("RUNNING")
            RUNNING,
            @Schema(description = "AlreadyCancel: UserManualCancel")
            @JsonProperty("CANCEL")
            CANCEL,
            @Schema(description = "AlreadyComplete: Parsing succeeded")
            @JsonProperty("DONE")
            DONE,
            @Schema(description = "Failed: ParsingProcessMiddleError occurred")
            @JsonProperty("FAIL")
            FAIL;
        }

        /**
         * LayoutRecognitionModelEnum
         */
        public enum LayoutRecognize {
            @Schema(description = "Deep document understanding model: suitable for complex layouts")
            @JsonProperty("DeepDOC")
            DeepDOC,
            @Schema(description = "Simple rule model: suitable for plain text")
            @JsonProperty("Simple")
            Simple;
        }

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        @Schema(description = "Document parsingParserParameter configuration")
        @JsonIgnoreProperties(ignoreUnknown = true)
        public static class ParserConfig implements Serializable {
            private static final long serialVersionUID = 1L;

            @Schema(description = "ChunkMaximum Token Count (RecommendationValue: 512, 1024, 2048)")
            @JsonProperty("chunk_token_num")
            private Integer chunkTokenNum;

            @Schema(description = "Segment delimiter (SupportEscapecharchar, Like \\n)")
            private String delimiter;

            @Schema(description = "LayoutRecognitionModel (DeepDOC/Simple)")
            @JsonProperty("layout_recognize")
            private LayoutRecognize layoutRecognize;

            @Schema(description = "WhetherWill Excel ConvertFor HTML tableGrid")
            @JsonProperty("html4excel")
            private Boolean html4excel;

            @Schema(description = "AutomaticExtractKeywordCount (0 RepresentsNotExtract)")
            @JsonProperty("auto_keywords")
            private Integer autoKeywords;

            @Schema(description = "AutomaticGenerateQuestionCount (0 RepresentsNotGenerate)")
            @JsonProperty("auto_questions")
            private Integer autoQuestions;

            @Schema(description = "AutomaticGenerateTagCount")
            @JsonProperty("topn_tags")
            private Integer topnTags;

            @Schema(description = "RAPTOR AdvancedIndexConfig")
            private RaptorConfig raptor;

            @Schema(description = "GraphRAG knowledge graph configuration")
            @JsonProperty("graphrag")
            private GraphRagConfig graphRag;

            @Data
            @Builder
            @NoArgsConstructor
            @AllArgsConstructor
            @Schema(description = "RAPTOR (Recursive summary index) configuration")
            @JsonIgnoreProperties(ignoreUnknown = true)
            public static class RaptorConfig implements Serializable {
                private static final long serialVersionUID = 1L;
                @Schema(description = "WhetherEnabled RAPTOR Index")
                @JsonProperty("use_raptor")
                private Boolean useRaptor;
            }

            @Data
            @Builder
            @NoArgsConstructor
            @AllArgsConstructor
            @Schema(description = "GraphRAG (DiagramEnhanceRetrieval) Config")
            @JsonIgnoreProperties(ignoreUnknown = true)
            public static class GraphRagConfig implements Serializable {
                private static final long serialVersionUID = 1L;
                @Schema(description = "WhetherEnabled GraphRAG Index")
                @JsonProperty("use_graphrag")
                private Boolean useGraphRag;
            }
        }
    }
}
