package xiaozhi.modules.device.vo;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Result of linking a robot")
public class DeviceLinkResultVO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "Device id (its MAC address)")
    private String deviceId;

    @Schema(description = "Character (agent) the robot now uses")
    private String agentId;

    @Schema(description = "True when a default character was created for this link")
    private boolean agentCreated;
}
