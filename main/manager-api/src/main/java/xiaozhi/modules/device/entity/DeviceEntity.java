package xiaozhi.modules.device.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = false)
@TableName("ai_device")
@Schema(description = "DeviceInformation")
public class DeviceEntity {

    @TableId(type = IdType.ASSIGN_UUID)
    @Schema(description = "ID")
    private String id;

    @Schema(description = "AssociateUser ID")
    private Long userId;

    @Schema(description = "MACAddress")
    private String macAddress;

    @Schema(description = "LastConnection time")
    private Date lastConnectedAt;

    @Schema(description = "AutomaticUpdateSwitch(0Close/1Enable)")
    private Integer autoUpdate;

    @Schema(description = "DeviceHardware model")
    private String board;

    @Schema(description = "DeviceAlias")
    private String alias;

    @Schema(description = "AgentID")
    private String agentId;

    @Schema(description = "Firmware versionnumber")
    private String appVersion;

    @Schema(description = "Sort")
    private Integer sort;

    @Schema(description = "Updater")
    @TableField(fill = FieldFill.UPDATE)
    private Long updater;

    @Schema(description = "Update time")
    @TableField(fill = FieldFill.UPDATE)
    private Date updateDate;

    @Schema(description = "Creator")
    @TableField(fill = FieldFill.INSERT)
    private Long creator;

    @Schema(description = "Creation time")
    @TableField(fill = FieldFill.INSERT)
    private Date createDate;
}