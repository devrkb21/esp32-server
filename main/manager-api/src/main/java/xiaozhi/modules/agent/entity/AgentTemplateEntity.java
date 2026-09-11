package xiaozhi.modules.agent.entity;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import lombok.Data;

/**
 * Agent configurationTemplatetable
 * 
 * @TableName ai_agent_template
 */
@TableName(value = "ai_agent_template")
@Data
public class AgentTemplateEntity implements Serializable {
    /**
     * AgentUnique identifier
     */
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;

    /**
     * AgentCode
     */
    private String agentCode;

    /**
     * Agent name
     */
    private String agentName;

    /**
     * Speech recognitionModelIdentifier
     */
    private String asrModelId;

    /**
     * Voice Activity DetectionIdentifier
     */
    private String vadModelId;

    /**
     * Large language modelIdentifier
     */
    private String llmModelId;

    /**
     * VLLMModelIdentifier
     */
    private String vllmModelId;

    /**
     * Speech synthesisModelIdentifier
     */
    private String ttsModelId;

    /**
     * Voice timbreIdentifier
     */
    private String ttsVoiceId;

    /**
     * Voice timbreLanguage
     */
    private String ttsLanguage;

    /**
     * TTSVolume
     */
    private Integer ttsVolume;

    /**
     * TTSSpeech rate
     */
    private Integer ttsRate;

    /**
     * TTSTone
     */
    private Integer ttsPitch;

    /**
     * Memory modelIdentifier
     */
    private String memModelId;

    /**
     * Intent modelIdentifier
     */
    private String intentModelId;

    /**
     * Chat historyConfiguration（0Do not record 1onlyRecord text 2Record textandSpeech）
     */
    private Integer chatHistoryConf;

    /**
     * RolesetdefineParameter
     */
    private String systemPrompt;

    /**
     * SummaryMemory
     */
    private String summaryMemory;
    /**
     * LanguageCode
     */
    private String langCode;

    /**
     * Interaction language
     */
    private String language;

    /**
     * SortWeight
     */
    private Integer sort;

    /**
     * Creator ID
     */
    private Long creator;

    /**
     * Creation time
     */
    private Date createdAt;

    /**
     * Updater ID
     */
    private Long updater;

    /**
     * Update time
     */
    private Date updatedAt;

    @TableField(exist = false)
    private static final long serialVersionUID = 1L;
}