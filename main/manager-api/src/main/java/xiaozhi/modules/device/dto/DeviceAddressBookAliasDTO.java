package xiaozhi.modules.device.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "Update device contact alias")
public class DeviceAddressBookAliasDTO {

    @NotBlank(message = "MACAddress cannot be empty")
    @Schema(description = "thisDeviceMACAddress")
    private String macAddress;

    @NotBlank(message = "TargetMACAddress cannot be empty")
    @Schema(description = "forpartyDeviceMACAddress")
    private String targetMac;

    @Schema(description = "meforforpartyAddress name")
    private String alias;
}