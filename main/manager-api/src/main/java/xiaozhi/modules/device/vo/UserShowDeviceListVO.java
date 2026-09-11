package xiaozhi.modules.device.vo;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonFormat;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "User display device listVO")
public class UserShowDeviceListVO {

    @Schema(description = "appVersion")
    private String appVersion;

    @Schema(description = "BindUsernamecall")
    private String bindUserName;

    @Schema(description = "DeviceModel")
    private String deviceType;

    @Schema(description = "DeviceModel(board)")
    private String board;

    @Schema(description = "DeviceUnique identifierchar")
    private String id;

    @Schema(description = "macAddress")
    private String macAddress;

    @Schema(description = "DeviceAlias")
    private String alias;

    @Schema(description = "AutomaticUpdateSwitch(0Close/1Enable)")
    private Integer autoUpdate;

    @Schema(description = "RecentforCall duration")
    private String recentChatTime;

    @Schema(description = "LastConnection timestamp（millis）", type = "string", example = "1783689702000")
    private Long lastConnectedAtTimestamp;

    @Schema(description = "Binding timestamp（millis）", type = "string", example = "1783689702000")
    private Long createDateTimestamp;

    @Schema(description = "Binding time（Compatible fields，pleaseUse createDateTimestamp）", deprecated = true)
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm:ss", timezone = "Asia/Dhaka")
    private Date createDate;

}
