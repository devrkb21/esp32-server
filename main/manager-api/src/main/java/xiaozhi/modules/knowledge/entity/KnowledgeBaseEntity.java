package xiaozhi.modules.knowledge.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@TableName(value = "ai_rag_dataset", autoResultMap = true)
@Schema(description = "Knowledge baseKnowledge basetable")
public class KnowledgeBaseEntity {

    @TableId(type = IdType.ASSIGN_UUID)
    @Schema(description = "Unique identifier")
    private String id;

    @Schema(description = "Knowledge base ID")
    private String datasetId;

//    @Deprecated
    @Schema(description = "RAGModel configurationID (ConnectionRAGFlowCredentialindicatefor)")
    private String ragModelId;

    @Schema(description = "TenantID")
    private String tenantId;

    @Schema(description = "Knowledge base name")
    private String name;

    @Schema(description = "Knowledge baseAvatar(Base64)")
    private String avatar;

    @Schema(description = "Knowledge base description")
    private String description;

    @Schema(description = "EmbeddingModel name")
    private String embeddingModel;

    @Schema(description = "PermissionSet: me/team")
    private String permission;

    @Schema(description = "Chunking method")
    private String chunkMethod;

    @Schema(description = "ParsingParserConfig(JSON String)")
    private String parserConfig;

    @Schema(description = "ChunkingTotal count")
    private Long chunkCount;

    @Schema(description = "DocumentTotal count")
    private Long documentCount;

    @Schema(description = "TotalTokenCount")
    private Long tokenNum;

    @Schema(description = "Status(0:Disabled 1:Enabled)")
    private Integer status;

    @Schema(description = "Creator")
    @TableField(fill = FieldFill.INSERT)
    private Long creator;

    @Schema(description = "Creation time")
    @TableField(fill = FieldFill.INSERT)
    private Date createdAt;

    @Schema(description = "Updater")
    @TableField(fill = FieldFill.UPDATE)
    private Long updater;

    @Schema(description = "Update time")
    @TableField(fill = FieldFill.UPDATE)
    private Date updatedAt;
}