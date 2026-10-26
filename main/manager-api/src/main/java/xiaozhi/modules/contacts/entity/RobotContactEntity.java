package xiaozhi.modules.contacts.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * A pair of robots of two accounts that may send each other voice messages. Asked for by one
 * owner (from one of their robots), accepted by the other (who picks one of theirs).
 */
@Data
@TableName("ai_robot_contact")
public class RobotContactEntity {
    @TableId
    private Long id;
    private Long fromUserId;
    private String fromDeviceId;
    private Long toUserId;
    private String toDeviceId;
    /** What the asking side calls the other robot */
    private String fromName;
    /** JSON array */
    private String fromAliases;
    /** What the accepting side calls the asking robot */
    private String toName;
    /** JSON array */
    private String toAliases;
    /** pending, accepted, declined */
    private String status;
    @TableField(fill = FieldFill.INSERT)
    private Long creator;
    @TableField(fill = FieldFill.INSERT)
    private Date createDate;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updater;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateDate;
}
