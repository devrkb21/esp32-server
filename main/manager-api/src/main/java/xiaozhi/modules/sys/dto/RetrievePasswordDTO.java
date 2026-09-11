package xiaozhi.modules.sys.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * Retrieve ***REDACTED***DTO
 */
@Data
@Schema(description = "Retrieve ***REDACTED***")
public class RetrievePasswordDTO implements Serializable {

    @Schema(description = "Phone numberCode")
    @NotBlank(message = "{sysuser.***REDACTED***.require}")
    private String phone;

    @Schema(description = "Captcha")
    @NotBlank(message = "{sysuser.***REDACTED***.require}")
    private String code;

    @Schema(description = "NewPassword")
    @NotBlank(message = "{sysuser.***REDACTED***.require}")
    private String ***REDACTED***;

    @Schema(description = "GraphicCaptcha ID")
    @NotBlank(message = "{sysuser.uuid.require}")
    private String captchaId;



}