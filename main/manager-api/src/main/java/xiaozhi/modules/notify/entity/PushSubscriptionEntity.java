package xiaozhi.modules.notify.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * Where to push a user's notifications (ai_push_subscription): a browser push subscription
 * (platform web / h5: endpoint + p256dh + auth) or a native push token (platform native,
 * provider in {@code p256dh}, token in {@code endpoint}; see NativePushSender).
 */
@Data
@TableName("ai_push_subscription")
public class PushSubscriptionEntity {
    @TableId
    private Long id;
    private Long userId;
    /** web | h5 | native */
    private String platform;
    private String endpoint;
    /** sha1(endpoint), unique */
    private String endpointHash;
    private String p256dh;
    private String auth;
    private Integer failCount;
    private Date lastOk;
    private Date createDate;
}
