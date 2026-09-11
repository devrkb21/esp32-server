package xiaozhi.modules.config.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "Get agent replacement wordsDTO")
public class CorrectWordsDTO {

    @NotBlank(message = "DeviceMACAddress cannot be empty")
    @Schema(description = "DeviceMACAddress")
    private String macAddress;
}
