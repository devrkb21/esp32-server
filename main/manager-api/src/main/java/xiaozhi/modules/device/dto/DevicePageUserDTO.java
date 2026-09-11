package xiaozhi.modules.device.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import lombok.Data;

/**
 * QueryAllDeviceDTO
 * 
 * @author zjy
 * @since 2025-3-21
 */
@Data
@Schema(description = "QueryAllDeviceDTO")
public class DevicePageUserDTO {

    @Schema(description = "Device keywords")
    private String keywords;

    @Schema(description = "Pages")
    @Min(value = 0, message = "{page.number}")
    private String page;

    @Schema(description = "Display columns")
    @Min(value = 0, message = "{limit.number}")
    private String limit;
}
