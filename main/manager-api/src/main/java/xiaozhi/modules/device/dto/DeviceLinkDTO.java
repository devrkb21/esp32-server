package xiaozhi.modules.device.dto;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Link a robot to the signed-in account")
public class DeviceLinkDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "The 6-digit code the robot shows", example = "123456")
    private String code;

    @Schema(description = "Character (agent) to use; optional when the user has zero or one")
    private String agentId;
}
