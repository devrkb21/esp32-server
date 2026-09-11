package xiaozhi.modules.voiceclone.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@Schema(description = "Voice cloningDTO")
public class VoiceCloneDTO {

    @Schema(description = "ModelID")
    private String modelId;

    @Schema(description = "Voice timbreIDList")
    private List<String> voiceIds;

    @Schema(description = "User ID")
    private Long userId;

    @Schema(description = "Language")
    private String languages;
}
