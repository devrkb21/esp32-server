package xiaozhi.modules.sys.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import lombok.Data;

/**
 * AdministratorPaginationUser parametersDTO
 * 
 * @author zjy
 * @since 2025-3-21
 */
@Data
@Schema(description = "AdministratorPaginationUser parametersDTO")
public class AdminPageUserDTO {

    @Schema(description = "Phone numberCode")
    private String mobile;

    @Schema(description = "Pages")
    @Min(value = 0, message = "{sort.number}")
    private String page;

    @Schema(description = "Display columns")
    @Min(value = 0, message = "{sort.number}")
    private String limit;
}
