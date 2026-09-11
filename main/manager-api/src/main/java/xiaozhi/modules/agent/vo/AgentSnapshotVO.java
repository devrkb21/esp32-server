package xiaozhi.modules.agent.vo;

import java.util.Date;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import xiaozhi.modules.agent.dto.AgentSnapshotDataDTO;

@Data
@Schema(description = "Agent configurationSnapshot")
public class AgentSnapshotVO {
    private String id;
    private String agentId;
    @Schema(description = "BelongingUser ID，Indicates owner of agent to which this snapshot belongs")
    private Long userId;
    private Integer versionNo;
    private List<String> changedFields;
    private List<String> fieldOrder;
    private String source;
    @Schema(description = "Restore sourceSnapshotID，Only restoreResultVersionhasValue")
    private String restoreFromSnapshotId;
    @Schema(description = "Restore sourceVersion number，Only restoreResultVersionhasValue")
    private Integer restoreFromVersionNo;
    @Schema(description = "Creator，Indicates operator who triggered this snapshot write")
    private Long creator;
    private Date createdAt;
    private AgentSnapshotDataDTO snapshotData;
    private AgentSnapshotDataDTO afterSnapshotData;
    @Schema(description = "Masked current configuration corresponding to restore preview，onlyDetailsInterfacehasValue")
    private AgentSnapshotDataDTO currentSnapshotData;
    @Schema(description = "Current configuration state fingerprint corresponding to restore preview，onlyDetailsInterfacehasValue")
    private String currentStateToken;
}
