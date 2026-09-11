package xiaozhi.modules.correctword.vo;

import java.util.Date;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Replacement word fileListVO")
public class CorrectWordFileVO {

    @Schema(description = "Replacement word fileID")
    private String id;

    @Schema(description = "originalOriginal file name")
    private String fileName;

    @Schema(description = "Replacement wordCount")
    private Integer wordCount;

    @Schema(description = "Replacement wordContent，One per line")
    private List<String> content;

    @Schema(description = "Creation time")
    private Date createdAt;

    @Schema(description = "Update time")
    private Date updatedAt;
}
