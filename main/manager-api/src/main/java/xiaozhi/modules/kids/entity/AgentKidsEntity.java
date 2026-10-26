package xiaozhi.modules.kids.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * Kids mode of one character (agent). No row: kids mode is off.
 */
@Data
@TableName("ai_agent_kids")
public class AgentKidsEntity {
    @TableId(type = IdType.INPUT)
    private String agentId;
    /** 0 off, 1 on */
    private Integer enabled;
    /** Age of the child, 3 to 12 */
    private Integer age;
    /** JSON array of topics TinyBot never talks about */
    private String blockedTopics;
    @TableField(fill = FieldFill.INSERT)
    private Long creator;
    @TableField(fill = FieldFill.INSERT)
    private Date createDate;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updater;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Date updateDate;
}
