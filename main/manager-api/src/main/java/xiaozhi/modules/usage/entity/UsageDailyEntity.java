package xiaozhi.modules.usage.entity;

import java.math.BigDecimal;
import java.util.Date;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * One day of AI usage of one robot and one model, as reported by xiaozhi-server.
 */
@Data
@TableName("ai_usage_daily")
public class UsageDailyEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** Day in the server's local time (yyyy-MM-dd) */
    private Date usageDate;
    private String macAddress;
    private Long userId;
    private String agentId;
    /** LLM, ASR or TTS */
    private String modelType;
    private String modelId;
    private Integer llmRequests;
    private Long promptTokens;
    private Long completionTokens;
    private BigDecimal asrSeconds;
    private Long ttsChars;
    private Integer quotaBlocked;
    private Date updateDate;
}
