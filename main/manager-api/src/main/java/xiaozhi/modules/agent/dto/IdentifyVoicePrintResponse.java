package xiaozhi.modules.agent.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Data;

/**
 * Object returned by voiceprint recognition interface
 */
@Data
public class IdentifyVoicePrintResponse {
    /**
     * mostMatchVoiceprintid
     */
    @JsonProperty("speaker_id")
    private String speakerId;
    /**
     * VoiceprintScore
     */
    private Double score;
}
