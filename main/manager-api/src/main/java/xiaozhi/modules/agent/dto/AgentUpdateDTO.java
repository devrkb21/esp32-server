package xiaozhi.modules.agent.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import xiaozhi.common.utils.JsonUtils;

/**
 * AgentUpdateDTO
 * specialUsed forUpdateAgent，idFieldismustNeed，Used to identify agent to update
 * OtherFieldallasNon-Required，onlyUpdatepromptprovideField
 */
@Data
@Schema(description = "AgentUpdateObject")
public class AgentUpdateDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    @Schema(description = "AgentCode", example = "AGT_1234567890", nullable = true)
    private String agentCode;

    @Schema(description = "Agent name", example = "Customer service assistant", nullable = true)
    private String agentName;

    @Schema(description = "Speech recognitionModelIdentifier", example = "asr_model_02", nullable = true)
    private String asrModelId;

    @Schema(description = "Voice Activity DetectionIdentifier", example = "vad_model_02", nullable = true)
    private String vadModelId;

    @Schema(description = "Large language modelIdentifier", example = "llm_model_02", nullable = true)
    private String llmModelId;

    @Schema(description = "smallModelIdentifier", example = "slm_model_02", nullable = true)
    private String slmModelId;

    @Schema(description = "VLLMModelIdentifier", example = "vllm_model_02", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private String vllmModelId;

    @Schema(description = "Speech synthesisModelIdentifier", example = "tts_model_02", requiredMode = Schema.RequiredMode.NOT_REQUIRED)
    private String ttsModelId;

    @Schema(description = "Voice timbreIdentifier", example = "voice_02", nullable = true)
    private String ttsVoiceId;

    @Schema(description = "Voice timbreLanguage", example = "Mandarin", nullable = true)
    private String ttsLanguage;

    @Schema(description = "TTSVolume", example = "50", nullable = true)
    private Integer ttsVolume;

    @Schema(description = "TTSSpeech rate", example = "50", nullable = true)
    private Integer ttsRate;

    @Schema(description = "TTSTone", example = "50", nullable = true)
    private Integer ttsPitch;

    @Schema(description = "Memory modelIdentifier", example = "mem_model_02", nullable = true)
    private String memModelId;

    @Schema(description = "Intent modelIdentifier", example = "intent_model_02", nullable = true)
    private String intentModelId;

    @Schema(description = "PluginFunctionInformation", nullable = true)
    private List<FunctionInfo> functions;

    @Schema(description = "RolesetdefineParameter", example = "You are a professional customer service assistant，Responsible for answering user questions and providing help", nullable = true)
    private String systemPrompt;

    @Schema(description = "SummaryMemory", example = "Build a growable dynamic memory network，While retaining key information within limited space，Intelligent maintenanceInformationEvolution trajectory\n"
            + "According toforvoiceRecord，SummaryuserreneedInformation，so as to provide more personalized services in future conversations", nullable = true)
    private String summaryMemory;

    @Schema(description = "Chat historyConfiguration（0Do not record 1onlyRecord text 2Record textandSpeech）", example = "3", nullable = true)
    private Integer chatHistoryConf;

    @Schema(description = "LanguageCode", example = "zh_CN", nullable = true)
    private String langCode;

    @Schema(description = "Interaction language", example = "indoc", nullable = true)
    private String language;

    @Schema(description = "Sort", example = "1", nullable = true)
    private Integer sort;

    @Schema(description = "Context providerConfiguration", nullable = true)
    private List<ContextProviderDTO> contextProviders;

    @Schema(description = "Replacement word fileIDList", nullable = true)
    private List<String> correctWordFileIds;

    @Schema(description = "TagNameList", nullable = true)
    private List<String> tagNames;

    @Schema(description = "TagIDList", nullable = true)
    private List<String> tagIds;

    @Data
    @Schema(description = "PluginFunctionInformation")
    public static class FunctionInfo implements Serializable {
        private static final TypeReference<HashMap<String, Object>> PARAM_INFO_TYPE = new TypeReference<>() {
        };

        @Schema(description = "PluginID", example = "plugin_01")
        private String pluginId;

        @Schema(description = "FunctionParameterInformation", nullable = true)
        private HashMap<String, Object> paramInfo = new HashMap<>();

        public void setParamInfo(Object paramInfo) {
            this.paramInfo = normalizeParamInfo(paramInfo);
        }

        private static HashMap<String, Object> normalizeParamInfo(Object paramInfo) {
            if (paramInfo == null) {
                return new HashMap<>();
            }
            if (paramInfo instanceof String value) {
                if (value.trim().isEmpty()) {
                    return new HashMap<>();
                }
                return JsonUtils.parseObject(value, PARAM_INFO_TYPE);
            }
            if (paramInfo instanceof Map<?, ?> value) {
                HashMap<String, Object> normalized = new HashMap<>();
                value.forEach((key, val) -> {
                    if (key != null) {
                        normalized.put(String.valueOf(key), val);
                    }
                });
                return normalized;
            }
            return JsonUtils.parseObject(JsonUtils.toJsonString(paramInfo), PARAM_INFO_TYPE);
        }

        private static final long serialVersionUID = 1L;
    }
}
