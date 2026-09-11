package xiaozhi.modules.agent.entity;

import java.math.BigDecimal;
import java.util.Date;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
@TableName("ai_agent")
@Schema(description = "Agent information")
public class AgentEntity {

    @TableId(type = IdType.ASSIGN_UUID)
    @Schema(description = "AgentUnique identifier")
    private String id;

    @Schema(description = "BelongingUser ID")
    private Long userId;

    @Schema(description = "AgentCode")
    private String agentCode;

    @Schema(description = "Agent name")
    private String agentName;

    @Schema(description = "Speech recognitionModelIdentifier")
    private String asrModelId;

    @Schema(description = "Voice Activity DetectionIdentifier")
    private String vadModelId;

    @Schema(description = "Large language modelIdentifier")
    private String llmModelId;

    @Schema(description = "smallModelIdentifier")
    private String slmModelId;

    @Schema(description = "VLLMModelIdentifier")
    private String vllmModelId;

    @Schema(description = "Speech synthesisModelIdentifier")
    private String ttsModelId;

    @Schema(description = "Voice timbreIdentifier")
    private String ttsVoiceId;

    @Schema(description = "Voice timbreLanguage")
    private String ttsLanguage;

    @Schema(description = "TTSVolume")
    private Integer ttsVolume;

    @Schema(description = "TTSSpeech rate")
    private Integer ttsRate;

    @Schema(description = "TTSTone")
    private Integer ttsPitch;

    @Schema(description = "Memory modelIdentifier")
    private String memModelId;

    @Schema(description = "Intent modelIdentifier")
    private String intentModelId;

    @Schema(description = "Chat historyConfiguration（0Do not record 1onlyRecord text 2Record textandSpeech）")
    private Integer chatHistoryConf;

    @Schema(description = "RolesetdefineParameter")
    private String systemPrompt;

    @Schema(description = "SummaryMemory", example = "Build a growable dynamic memory network，While retaining key information within limited space，Intelligent maintenanceInformationEvolution trajectory\n" +
            "According toforvoiceRecord，SummaryuserreneedInformation，so as to provide more personalized services in future conversations", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private String summaryMemory;

    @Schema(description = "LanguageCode")
    private String langCode;

    @Schema(description = "Interaction language")
    private String language;

    @Schema(description = "Sort")
    private Integer sort;

    @Schema(description = "Creator")
    private Long creator;

    @Schema(description = "Creation time")
    private Date createdAt;

    @Schema(description = "Updater")
    private Long updater;

    @Schema(description = "Update time")
    private Date updatedAt;
}
