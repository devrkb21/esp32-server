package xiaozhi.modules.sys.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;
import java.util.Date;

/**
 * Dictionary dataVO
 */
@Data
@Schema(description = "Dictionary dataVO")
public class SysDictDataVO implements Serializable {
    @Schema(description = "Primary key")
    private Long id;

    @Schema(description = "Dictionary typeID")
    private Long dictTypeId;

    @Schema(description = "Dictionary label")
    private String dictLabel;

    @Schema(description = "Dictionary value")
    private String dictValue;

    @Schema(description = "Remark")
    private String remark;

    @Schema(description = "Sort")
    private Integer sort;

    @Schema(description = "Creator")
    private Long creator;

    @Schema(description = "CreatorName")
    private String creatorName;

    @Schema(description = "Creation time")
    private Date createDate;

    @Schema(description = "Updater")
    private Long updater;

    @Schema(description = "UpdaterName")
    private String updaterName;

    @Schema(description = "Update time")
    private Date updateDate;
}
