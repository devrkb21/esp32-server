package xiaozhi.modules.voiceclone.entity;

import java.util.Date;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = false)
@TableName("ai_voice_clone")
@Schema(description = "Voice cloning")
public class VoiceCloneEntity {

    @TableId(type = IdType.ASSIGN_UUID)
    @Schema(description = "Unique identifier")
    private String id;

    @Schema(description = "VoiceName")
    private String name;

    @Schema(description = "Modelid")
    private String modelId;

    @Schema(description = "Voiceid")
    private String voiceId;

    @Schema(description = "Language")
    private String languages;

    @Schema(description = "User ID（AssociateUsertable）")
    private Long userId;

    @Schema(description = "Voice")
    private byte[] voice;

    @Schema(description = "Training status：0Pending training 1Training 2Training succeeded 3Training failed")
    private Integer trainStatus;

    @Schema(description = "TrainingErrororiginalcause")
    private String trainError;

    @Schema(description = "Creator")
    @TableField(fill = FieldFill.INSERT)
    private Long creator;

    @Schema(description = "Creation time")
    @TableField(fill = FieldFill.INSERT)
    private Date createDate;
}
