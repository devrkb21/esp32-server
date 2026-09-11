package xiaozhi.modules.config.dto;

import java.util.Map;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "Get agent model configurationDTO")
public class AgentModelsDTO {

    @NotBlank(message = "DeviceMACAddress cannot be empty")
    @Schema(description = "DeviceMACAddress")
    private String macAddress;

    @NotBlank(message = "ClientIDcannot be empty")
    @Schema(description = "ClientID")
    private String clientId;

    @NotNull(message = "Client instantiated models cannot be empty")
    @Schema(description = "ClientInstantiated models")
    private Map<String, String> selectedModule;
}