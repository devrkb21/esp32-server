package xiaozhi.modules.sys.dto;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * Change ***REDACTED***
 */
@Data
@Schema(description = "Change ***REDACTED***")
public class PasswordDTO implements Serializable {

    @Schema(description = "originalPassword")
    @NotBlank(message = "{sysuser.***REDACTED***.require}")
    private String ***REDACTED***;

    @Schema(description = "NewPassword")
    @NotBlank(message = "{sysuser.***REDACTED***.require}")
    private String newPassword;

}