package xiaozhi.modules.home.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/** A device the robot may switch: a Home Assistant entity or a generic MQTT device. */
@Data
@TableName("ai_home_device")
public class HomeDeviceEntity {
    @TableId
    private Long id;
    private Long userId;
    /** ha or mqtt */
    private String source;
    private String entityId;
    /** light, switch, fan, climate or cover */
    private String domain;
    private String name;
    /** JSON array of strings */
    private String aliases;
    private String topic;
    private String payloadOn;
    private String payloadOff;
    private Boolean enabled;
    private Integer sort;
    @TableField(fill = FieldFill.INSERT)
    private Long creator;
    @TableField(fill = FieldFill.INSERT)
    private Date createDate;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updater;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateDate;
}
