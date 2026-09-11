package xiaozhi.modules.correctword.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@TableName("ai_agent_correct_word_item")
@Schema(description = "Replacement wordTerm entry")
public class CorrectWordItemEntity {

    @TableId(type = IdType.ASSIGN_UUID)
    @Schema(description = "Term entryID")
    private String id;

    @Schema(description = "Belonging fileID")
    private String fileId;

    @Schema(description = "originalword")
    private String sourceWord;

    @Schema(description = "Replacement word")
    private String targetWord;
}
