package xiaozhi.modules.summary.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * One robot's day in a few numbers and a short text (ai_daily_summary).
 */
@Data
@TableName("ai_daily_summary")
public class DailySummaryEntity {
    @TableId
    private Long id;
    private String deviceId;
    /** YYYY-MM-DD (Asia/Dhaka) */
    private String day;
    /** The numbers as JSON (SummaryBuilder.Row without the texts) */
    private String data;
    private String textBn;
    private String textEn;
    /** 1 after the 23:55 build: the day is over */
    private Integer finalFlag;
    private Date createDate;
    private Date updateDate;
}
