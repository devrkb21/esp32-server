package xiaozhi.modules.notify.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * A user's notification preferences as JSON (ai_notify_pref), see NotifyPrefs.
 */
@Data
@TableName("ai_notify_pref")
public class NotifyPrefEntity {
    @TableId(value = "user_id", type = IdType.INPUT)
    private Long userId;
    private String prefs;
    private Date updateDate;
}
