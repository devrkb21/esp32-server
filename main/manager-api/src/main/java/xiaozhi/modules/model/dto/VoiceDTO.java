package xiaozhi.modules.model.dto;

import java.io.Serializable;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Voice timbreInformation")
public class VoiceDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "Voice timbreID")
    private String id;

    @Schema(description = "Voice timbre name")
    private String name;

    @Schema(description = "Audio playbackAddress")
    private String voiceDemo;
    
    @Schema(description = "LanguageType")
    private String languages;
    
    @Schema(description = "WhetherasCloned timbre")
    private Boolean isClone;

    // Add two-parameter constructor，Maintain backward compatibility
    public VoiceDTO(String id, String name) {
        this.id = id;
        this.name = name;
        this.voiceDemo = null;
        this.languages = null;
        this.isClone = false; // Default is not cloned timbre
    }
    
    // Add three-parameter constructor，Used forStandard timbre
    public VoiceDTO(String id, String name, String voiceDemo) {
        this.id = id;
        this.name = name;
        this.voiceDemo = voiceDemo;
        this.languages = null;
        this.isClone = false;
    }

}