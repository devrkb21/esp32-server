package xiaozhi.modules.notify.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * One notification for one user (ai_notification).
 */
@Data
@TableName("ai_notification")
public class NotificationEntity {
    @TableId
    private Long id;
    private Long userId;
    private String type;
    private String groupKey;
    private String titleBn;
    private String titleEn;
    private String bodyBn;
    private String bodyEn;
    private String deviceId;
    private String robotName;
    /** Same key twice for the same user creates nothing (see NotifyMessage) */
    private String dedupeKey;
    private Date readAt;
    private Date createDate;
}
