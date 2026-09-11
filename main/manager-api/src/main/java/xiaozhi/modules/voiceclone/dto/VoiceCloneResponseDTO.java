package xiaozhi.modules.voiceclone.dto;

import java.util.Date;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Voice cloningResponseDTO
 * Used to display voice cloning information to frontend，Contains model name and user name
 */
@Data
@Schema(description = "Voice cloningResponseDTO")
public class VoiceCloneResponseDTO {

    @Schema(description = "Unique identifier")
    private String id;

    @Schema(description = "VoiceName")
    private String name;

    @Schema(description = "Modelid")
    private String modelId;

    @Schema(description = "Model name")
    private String modelName;

    @Schema(description = "Voiceid")
    private String voiceId;

    @Schema(description = "Language")
    private String languages;

    @Schema(description = "User ID（AssociateUsertable）")
    private Long userId;

    @Schema(description = "Usernamecall")
    private String userName;

    @Schema(description = "Training status：0Pending training 1Training 2Training succeeded 3Training failed")
    private Integer trainStatus;

    @Schema(description = "TrainingErrororiginalcause")
    private String trainError;

    @Schema(description = "Creation time")
    private Date createDate;

    @Schema(description = "WhetherHas audioData")
    private Boolean hasVoice;
}