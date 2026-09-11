package xiaozhi.modules.device.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.util.List;

@Setter
@Getter
@Schema(description = "Device firmware information report request body")
public class DeviceReportReqDTO implements Serializable {
    private static final long serialVersionUID = 1L;
    // region EntityAttribute
    @Schema(description = "BoardFirmware versionnumber")
    private Integer version;

    @Schema(description = "Flash size（Unit：Bytes）")
    @JsonProperty("flash_size")
    private Integer flashSize;

    @Schema(description = "Minimum free heap memory（Bytes）")
    @JsonProperty("minimum_free_heap_size")
    private Integer minimumFreeHeapSize;

    @Schema(description = "Device MAC Address")
    @JsonProperty("mac_address")
    private String macAddress;

    @Schema(description = "DeviceUnique identifier UUID")
    private String uuid;

    @Schema(description = "Chip modelName")
    @JsonProperty("chip_model_name")
    private String chipModelName;

    @Schema(description = "Chip detailsInformation")
    @JsonProperty("chip_info")
    private ChipInfo chipInfo;

    @Schema(description = "Application programInformation")
    private Application application;

    @Schema(description = "Partition tableList")
    @JsonProperty("partition_table")
    private List<Partition> partitionTable;

    @Schema(description = "Currently running OTA PartitionInformation")
    private OtaInfo ota;

    @Schema(description = "BoardConfigurationInformation")
    private BoardInfo board;

    // endregion

    @Getter
    @Setter
    @Schema(description = "ChipInformation")
    public static class ChipInfo {
        @Schema(description = "ChipModelproxyCode")
        private Integer model;

        @Schema(description = "Cores")
        private Integer cores;

        @Schema(description = "Hardware revision")
        private Integer revision;

        @Schema(description = "Chip features flag")
        private Integer features;
    }

    @Getter
    @Setter
    @Schema(description = "Board compilationInformation")
    public static class Application {
        @Schema(description = "Name")
        private String name;

        @Schema(description = "ApplicationVersion number")
        private String version;

        @Schema(description = "Compilation time（UTC ISOFormat）")
        @JsonProperty("compile_time")
        private String compileTime;

        @Schema(description = "ESP-IDF Version number")
        @JsonProperty("idf_version")
        private String idfVersion;

        @Schema(description = "ELF File SHA256 Validate")
        @JsonProperty("elf_sha256")
        private String elfSha256;
    }

    @Getter
    @Setter
    @Schema(description = "PartitionInformation")
    public static class Partition {
        @Schema(description = "Partition label name")
        private String label;

        @Schema(description = "PartitionType")
        private Integer type;

        @Schema(description = "subType")
        private Integer subtype;

        @Schema(description = "StartAddress")
        private Integer address;

        @Schema(description = "Partition size")
        private Integer size;
    }

    @Getter
    @Setter
    @Schema(description = "OTAInformation")
    public static class OtaInfo {
        @Schema(description = "CurrentOTATag")
        private String label;
    }

    @Getter
    @Setter
    @Schema(description = "Board connection and network information")
    public static class BoardInfo {
        @Schema(description = "BoardType")
        private String type;

        @Schema(description = "Connection Wi-Fi SSID")
        private String ssid;

        @Schema(description = "Wi-Fi SignalStrength（RSSI）")
        private Integer rssi;

        @Schema(description = "Wi-Fi Channel")
        private Integer channel;

        @Schema(description = "IP Address")
        private String ip;

        @Schema(description = "MAC Address")
        private String mac;
    }
}
