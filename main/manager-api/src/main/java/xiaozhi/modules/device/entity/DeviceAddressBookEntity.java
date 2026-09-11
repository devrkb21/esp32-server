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
@TableName("ai_device_address_book")
@Schema(description = "DeviceContacts")
public class DeviceAddressBookEntity {

    @TableId(type = IdType.INPUT)
    @Schema(description = "thisDeviceMACAddress")
    private String macAddress;

    @Schema(description = "forpartyDeviceMACAddress")
    private String targetMac;

    @Schema(description = "meforforpartyAddress name")
    private String alias;

    @Schema(description = "WhetherAuthorized to call")
    private Boolean hasPermission;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "Creator")
    private Long creator;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "Creation time")
    private Date createDate;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    @Schema(description = "Updateuser")
    private Long updater;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    @Schema(description = "Update time")
    private Date updateDate;
}