package xiaozhi.modules.knowledge.dto;

import java.io.Serial;
import java.io.Serializable;
import java.util.Date;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Knowledge baseKnowledge base")
public class KnowledgeBaseDTO implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Schema(description = "Unique identifier")
    private String id;

    @Schema(description = "Knowledge base ID")
    private String datasetId;

    @Schema(description = "RAGModel configurationID")
    private String ragModelId;

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

    @Schema(description = "TotalTokenCount")
    private Long tokenNum;

    @Schema(description = "Status(0:Disabled 1:Enabled)")
    private Integer status;

    @Schema(description = "Creator")
    private Long creator;

    @Schema(description = "Creation time")
    private Date createdAt;

    @Schema(description = "Updater")
    private Long updater;

    @Schema(description = "Update time")
    private Date updatedAt;

    @Schema(description = "DocumentCount")
    private Integer documentCount;

    @Schema(description = "ExceptionpromptIndicate")
    private String errorMessage;
}