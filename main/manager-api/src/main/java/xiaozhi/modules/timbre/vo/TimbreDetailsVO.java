package xiaozhi.modules.timbre.vo;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Voice timbre detailsDisplayVO
 * 
 * @author zjy
 * @since 2025-3-21
 */
@Data
public class TimbreDetailsVO implements Serializable {
    @Schema(description = "Voice timbreid")
    private String id;

    @Schema(description = "Language")
    private String languages;

    @Schema(description = "Voice timbre name")
    private String name;

    @Schema(description = "Remark")
    private String remark;

    @Schema(description = "Reference audio path")
    private String referenceAudio;

    @Schema(description = "Reference text")
    private String referenceText;

    @Schema(description = "Sort")
    private Long sort;

    @Schema(description = "forshould TTS ModelPrimary key")
    private String ttsModelId;

    @Schema(description = "Voice timbre code")
    private String ttsVoice;

    @Schema(description = "Audio playbackAddress")
    private String voiceDemo;

}
