package xiaozhi.modules.home.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/** One smart-home integration per user. haToken and mqttPassword hold encrypted values. */
@Data
@TableName("ai_home_integration")
public class HomeIntegrationEntity {
    @TableId
    private Long id;
    private Long userId;
    private String haBaseUrl;
    private String haToken;
    private String mqttHost;
    private Integer mqttPort;
    private String mqttUsername;
    private String mqttPassword;
    private Boolean mqttTls;
    @TableField(fill = FieldFill.INSERT)
    private Long creator;
    @TableField(fill = FieldFill.INSERT)
    private Date createDate;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updater;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateDate;
}
