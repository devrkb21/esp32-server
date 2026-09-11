package xiaozhi.modules.agent.dto;

import java.util.Date;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import xiaozhi.modules.agent.dto.AgentTagDTO;

/**
 * AgentData transfer object
 * Used to transfer agent-related data between service layer and controller layer
 */
@Data
@Schema(description = "AgentObject")
public class AgentDTO {
    @Schema(description = "AgentCode", example = "AGT_1234567890")
    private String id;

    @Schema(description = "Agent name", example = "Customer service assistant")
    private String agentName;

    @Schema(description = "Speech synthesisModel name", example = "tts_model_01")
    private String ttsModelName;

    @Schema(description = "Voice timbre name", example = "voice_01")
    private String ttsVoiceName;

    @Schema(description = "Large language modelName", example = "llm_model_01")
    private String llmModelName;

    @Schema(description = "VisionModel name", example = "vllm_model_01")
    private String vllmModelName;

    @Schema(description = "Memory modelID", example = "mem_model_01")
    private String memModelId;

    @Schema(description = "RolesetdefineParameter", example = "You are a professional customer service assistant，Responsible for answering user questions and providing help")
    private String systemPrompt;

    @Schema(description = "SummaryMemory", example = "Build a growable dynamic memory network，While retaining key information within limited space，Intelligent maintenanceInformationEvolution trajectory\n" +
            "According toforvoiceRecord，SummaryuserreneedInformation，so as to provide more personalized services in future conversations", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private String summaryMemory;

    @Schema(description = "LastConnection time", example = "2024-03-20 10:00:00")
    private Date lastConnectedAt;

    @Schema(description = "Device count", example = "10")
    private Integer deviceCount;

    @Schema(description = "TagList")
    private List<AgentTagDTO> tags;
}
