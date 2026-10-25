package xiaozhi.modules.device.vo;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "A robot waiting to be linked (no secrets, no full MAC)")
public class DeviceLinkInfoVO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "The 6-digit code")
    private String code;

    @Schema(description = "Board type the robot reported")
    private String board;

    @Schema(description = "Resolved product key")
    private String productKey;

    @Schema(description = "Product name (English)")
    private String productNameEn;

    @Schema(description = "Product name (Bangla)")
    private String productNameBn;

    @Schema(description = "Product icon URL, if any")
    private String productIconUrl;

    @Schema(description = "Last 4 hex digits of the robot's MAC, to tell two robots apart")
    private String macTail;

    @Schema(description = "Always true: unknown or expired codes return an error instead")
    private boolean valid = true;
}
