package xiaozhi.modules.agent.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@TableName("ai_agent_snapshot")
@Schema(description = "Agent configurationSnapshot")
public class AgentSnapshotEntity {

    @TableId(type = IdType.ASSIGN_UUID)
    @Schema(description = "SnapshotID")
    private String id;

    @Schema(description = "AgentID")
    private String agentId;

    @Schema(description = "BelongingUser ID")
    private Long userId;

    @Schema(description = "Version number")
    private Integer versionNo;

    @Schema(description = "Snapshot dataJSON")
    private String snapshotData;

    @Schema(description = "ChangeFieldJSON")
    private String changedFields;

    @Schema(description = "SnapshotSource")
    private String source;

    @Schema(description = "Restore sourceSnapshotID")
    private String restoreFromSnapshotId;

    @Schema(description = "Restore sourceVersion number")
    private Integer restoreFromVersionNo;

    @Schema(description = "Creator")
    private Long creator;

    @Schema(description = "Creation time")
    private Date createdAt;

    @Schema(description = "Snapshot dataMaskingRuleVersion")
    private Integer redactionVersion;
}
