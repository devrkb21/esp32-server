package xiaozhi.modules.knowledge.dto;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;
import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@Schema(description = "Knowledge baseDocument")
@JsonIgnoreProperties(ignoreUnknown = true)
public class KnowledgeFilesDTO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;
    @Schema(description = "Unique identifier")
    private String id;

    @Schema(description = "DocumentID")
    private String documentId;

    @Schema(description = "Knowledge base ID")
    private String datasetId;

    @Schema(description = "DocumentName")
    private String name;

    @Schema(description = "DocumentType")
    private String fileType;

    @Schema(description = "File size（Bytes）")
    private Long fileSize;

    @Schema(description = "File path")
    private String filePath;

    @Schema(description = "ParsingProgress (0.0 ~ 1.0)")
    private Double progress;

    @Schema(description = "Thumbnail (Base64 or URL)")
    private String thumbnail;

    @Schema(description = "ParsingConsumewhen (Unit: s)")
    private Double processDuration;

    @Schema(description = "SourceType (local, s3, url Etc)")
    private String sourceType;

    @Schema(description = "MetadataField (Map Format)")
    private Map<String, Object> metaFields;

    @Schema(description = "Chunking method")
    private String chunkMethod;

    @Schema(description = "ParsingParserConfig")
    private Map<String, Object> parserConfig;

    @Schema(description = "AvailableStatus (1: Enabled/Normal, 0: Disabled/Invalidate)")
    private String status;

    @Schema(description = "RunningStatus (UNSTART/RUNNING/CANCEL/DONE/FAIL)")
    private String run;

    @Schema(description = "Creator")
    private Long creator;

    @Schema(description = "Creation time")
    private Date createdAt;

    @Schema(description = "Updater")
    private Long updater;

    @Schema(description = "Update time")
    private Date updatedAt;

    @Schema(description = "ChunkingCount")
    private Integer chunkCount;

    @Schema(description = "TokenCount")
    private Long tokenCount;

    @Schema(description = "ParsingErrorInfo")
    private String error;

    // Document parsingStatusConstantsDefine
    private static final Integer STATUS_UNSTART = 0;
    private static final Integer STATUS_RUNNING = 1;
    private static final Integer STATUS_CANCEL = 2;
    private static final Integer STATUS_DONE = 3;
    private static final Integer STATUS_FAIL = 4;

    /**
     * GetDocument parsingStatusCode（Based onrunFieldConvert）
     */
    public Integer getParseStatusCode() {
        if (run == null) {
            return STATUS_UNSTART;
        }

        // RAGFlowAccording torunValue of field directly maps to corresponding status code
        switch (run.toUpperCase()) {
            case "RUNNING":
                return STATUS_RUNNING;
            case "CANCEL":
                return STATUS_CANCEL;
            case "DONE":
                return STATUS_DONE;
            case "FAIL":
                return STATUS_FAIL;
            case "UNSTART":
            default:
                return STATUS_UNSTART;
        }
    }

}