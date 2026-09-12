package xiaozhi.modules.agent.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.io.Serializable;

/**
 * Voiceprint Security and Speaker-Restricted Actions Settings DTO
 */
@Data
@Schema(description = "Voiceprint Security and Speaker Policy Settings")
public class VoiceprintSecurityDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "Confidence Threshold for voiceprint similarity (0.50 - 0.95)", example = "0.70")
    private Double confidenceThreshold;

    @Schema(description = "Whether to require voice match before executing Smart Home commands", example = "false")
    private Boolean requireVoiceMatchSmartHome;

    @Schema(description = "Whether sensitive actions (e.g. reboot, lock/unlock) require Admin speaker", example = "true")
    private Boolean adminSpeakerOnly;

    public Double getConfidenceThreshold() {
        return confidenceThreshold;
    }

    public void setConfidenceThreshold(Double confidenceThreshold) {
        this.confidenceThreshold = confidenceThreshold;
    }

    public Boolean getRequireVoiceMatchSmartHome() {
        return requireVoiceMatchSmartHome;
    }

    public void setRequireVoiceMatchSmartHome(Boolean requireVoiceMatchSmartHome) {
        this.requireVoiceMatchSmartHome = requireVoiceMatchSmartHome;
    }

    public Boolean getAdminSpeakerOnly() {
        return adminSpeakerOnly;
    }

    public void setAdminSpeakerOnly(Boolean adminSpeakerOnly) {
        this.adminSpeakerOnly = adminSpeakerOnly;
    }
}
