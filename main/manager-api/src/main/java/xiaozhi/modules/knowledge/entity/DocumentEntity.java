package xiaozhi.modules.knowledge.entity;

import java.io.Serializable;
import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Documenttable (Shadow DB for RAGFlow Documents)
 * ToshouldtableName: ai_knowledge_document
 */
@Data
@TableName(value = "ai_rag_knowledge_document", autoResultMap = true)
@Schema(description = "Knowledge baseDocumenttable")
public class DocumentEntity implements Serializable {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.ASSIGN_UUID)
    @Schema(description = "thisLocalUniqueID")
    private String id;

    @Schema(description = "Knowledge base ID (Associate ai_rag_dataset.dataset_id)")
    private String datasetId;

    @Schema(description = "RAGFlowDocumentID (RemoteID)")
    private String documentId;

    @Schema(description = "DocumentName")
    private String name;

    @Schema(description = "File size(Bytes)")
    private Long size;

    @Schema(description = "FileType(pdf/doc/txtEtc)")
    private String type;

    @Schema(description = "Chunking method")
    private String chunkMethod;

    @Schema(description = "ParsingConfig(JSON String)")
    private String parserConfig;

    @Schema(description = "AvailableStatus (1: Enabled/Normal, 0: Disabled/Invalidate)")
    private String status;

    @Schema(description = "RunningStatus (UNSTART/RUNNING/CANCEL/DONE/FAIL)")
    private String run;

    @Schema(description = "ParsingProgress (0.0 ~ 1.0)")
    private Double progress;

    @Schema(description = "Thumbnail (Base64 or URL)")
    private String thumbnail;

    @Schema(description = "ParsingConsumewhen (Unit: s)")
    private Double processDuration;

    @Schema(description = "SelfDefineMetadata (JSON Format)")
    private String metaFields;

    @Schema(description = "SourceType (local, s3, url Etc)")
    private String sourceType;

    @Schema(description = "ParsingErrorInfo")
    private String error;

    @Schema(description = "ChunkingCount")
    private Integer chunkCount;

    @Schema(description = "TokenCount")
    private Long tokenCount;

    @Schema(description = "WhetherEnabled (0:Disabled 1:Enabled)")
    private Integer enabled;

    @Schema(description = "Creator")
    @TableField(fill = FieldFill.INSERT)
    private Long creator;

    @Schema(description = "Creation time")
    @TableField(fill = FieldFill.INSERT)
    private Date createdAt;

    @Schema(description = "Update time")
    @TableField(fill = FieldFill.UPDATE)
    private Date updatedAt;

    @Schema(description = "MostNewSyncTime")
    private Date lastSyncAt;
}
