package xiaozhi.modules.family.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * One robot shared with one other account (family sharing). The device keeps its owner
 * (ai_device.user_id); this row gives another user a role on it once they accept the invite.
 */
@Data
@TableName("ai_device_share")
public class DeviceShareEntity {
    @TableId
    private Long id;
    /** ai_device.id */
    private String deviceId;
    /** The robot's owner when the invite was made (ai_device.user_id) */
    private Long ownerId;
    /** The account the robot is shared with */
    private Long userId;
    /** member | co_owner */
    private String role;
    /** pending | accepted | declined */
    private String status;
    /** Who sent the invite */
    private Long invitedBy;
    private Date respondedAt;
    private Date createDate;
    private Date updateDate;
}
