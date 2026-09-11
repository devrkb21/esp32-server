package xiaozhi.modules.agent.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import lombok.RequiredArgsConstructor;
import xiaozhi.common.constant.Constant;
import xiaozhi.modules.agent.dto.AgentChatHistoryDTO;
import xiaozhi.modules.agent.dto.AgentChatSummaryDTO;
import xiaozhi.modules.agent.dto.AgentMemoryDTO;
import xiaozhi.modules.agent.dto.AgentUpdateDTO;
import xiaozhi.modules.agent.entity.AgentChatHistoryEntity;
import xiaozhi.modules.agent.service.AgentChatHistoryService;
import xiaozhi.modules.agent.service.AgentChatSummaryService;
import xiaozhi.modules.agent.service.AgentChatTitleService;
import xiaozhi.modules.agent.service.AgentService;
import xiaozhi.modules.agent.vo.AgentInfoVO;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.llm.service.LLMService;
import xiaozhi.modules.model.entity.ModelConfigEntity;
import xiaozhi.modules.model.service.ModelConfigService;

/**
 * Agent chat history summary service implementation class
 * ImplementPythonsidemem_local_short.pyinSummaryLogic
 */
@Service
@RequiredArgsConstructor
public class AgentChatSummaryServiceImpl implements AgentChatSummaryService {

    private static final Logger log = LoggerFactory.getLogger(AgentChatSummaryServiceImpl.class);

    private final AgentChatHistoryService agentChatHistoryService;
    private final AgentService agentService;
    private final AgentChatTitleService agentChatTitleService;
    private final DeviceService deviceService;
    private final LLMService llmService;
    private final ModelConfigService modelConfigService;

    // SummaryRuleConstants
    private static final int MAX_SUMMARY_LENGTH = 1800; // MaximumSummaryLength
    private static final Pattern JSON_PATTERN = Pattern.compile("\\{.*?\\}", Pattern.DOTALL);
    private static final Pattern DEVICE_CONTROL_PATTERN = Pattern.compile("Device Control|Device Operation|Control Device|Device Status",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern WEATHER_PATTERN = Pattern.compile("Weather|Temperature|Humidity|Rainfall|Meteorology", Pattern.CASE_INSENSITIVE);
    private static final Pattern DATE_PATTERN = Pattern.compile("Date|Time|Day of week|Month|Year", Pattern.CASE_INSENSITIVE);

    private AgentChatSummaryDTO generateChatSummary(String sessionId) {
        try {
            System.out.println("StartGenerateSession " + sessionId + " Chat historySummary");

            // 1. According tosessionIdGetChat history
            List<AgentChatHistoryDTO> chatHistory = getChatHistoryBySessionId(sessionId);
            if (chatHistory == null || chatHistory.isEmpty()) {
                return new AgentChatSummaryDTO(sessionId, "No chat records found for this session");
            }

            // 2. Get agentInformation
            String agentId = getAgentIdFromSession(sessionId, chatHistory);
            if (StringUtils.isBlank(agentId)) {
                return new AgentChatSummaryDTO(sessionId, "Unable to get agent information");
            }

            // 3. ExtractKeyforvoiceContent
            List<String> meaningfulMessages = extractMeaningfulMessages(chatHistory);
            if (meaningfulMessages.isEmpty()) {
                return new AgentChatSummaryDTO(sessionId, "No valid dialogue content to summarize");
            }

            // 4. GenerateSummary（generateSummaryFromMessagesMethod already contains length restriction logic）
            String summary = generateSummaryFromMessages(meaningfulMessages, agentId);

            log.info("SuccessGenerateSession {} Chat historySummary，Length: {} charchar", sessionId, summary.length());
            return new AgentChatSummaryDTO(sessionId, agentId, summary);

        } catch (Exception e) {
            log.error("GenerateSession {} error occurred when summarizing chat history of: {}", sessionId, e.getMessage());
            return new AgentChatSummaryDTO(sessionId, "Error occurred while generating summary: " + e.getMessage());
        }
    }

    @Override
    public boolean generateAndSaveChatSummary(String sessionId) {
        try {
            DeviceEntity device = getDeviceBySessionId(sessionId);
            if (device == null) {
                log.info("Not foundandSession {} AssociateDevice", sessionId);
                return false;
            }

            String agentId = device.getAgentId();
            String memModelId = agentService.getAgentById(agentId).getMemModelId();

            if (memModelId == null || memModelId.equals(Constant.MEMORY_MEM_REPORT_ONLY)) {
                log.info("Session {} Use chat-report-only mode，SkipMemorySummary", sessionId);
                return true;
            }

            boolean shouldSummarizeMemory = !memModelId.equals(Constant.MEMORY_NO_MEM)
                    && !memModelId.equals(Constant.MEMORY_MEM0AI)
                    && !memModelId.equals(Constant.MEMORY_POWERMEM);

            if (shouldSummarizeMemory) {
                AgentChatSummaryDTO summaryDTO = generateChatSummary(sessionId);
                if (summaryDTO.isSuccess()) {
                    agentService.updateAgentById(agentId, new AgentUpdateDTO() {
                        {
                            setSummaryMemory(summaryDTO.getSummary());
                        }
                    }, false);
                    log.info("SuccessSaveSession {} summarize chat history to agent {}", sessionId, agentId);
                } else {
                    log.info("GenerateSummaryFail: {}", summaryDTO.getErrorMessage());
                }
            } else {
                log.info("Session {} Use {} Mode，SkipMemorySummary", sessionId, memModelId);
            }

            return true;

        } catch (Exception e) {
            log.error("SaveSession {} error occurred when summarizing chat history of: {}", sessionId, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean generateAndSaveChatTitle(String sessionId) {
        try {
            // AutomaticGetagentId
            String agentId = findAgentIdBySessionId(sessionId);
            if (StringUtils.isBlank(agentId)) {
                log.warn("Session {} Unable to get agent information，SkipTitleGenerate", sessionId);
                return false;
            }

            List<AgentChatHistoryDTO> chatHistory = getChatHistoryBySessionId(sessionId);
            if (chatHistory == null || chatHistory.isEmpty()) {
                return false;
            }

            List<String> meaningfulMessages = extractMeaningfulMessages(chatHistory);
            if (meaningfulMessages.isEmpty()) {
                return false;
            }

            StringBuilder conversation = new StringBuilder();
            for (int i = 0; i < meaningfulMessages.size(); i++) {
                conversation.append("Message").append(i + 1).append(": ").append(meaningfulMessages.get(i)).append("\n");
            }

            String slmModelId = getSlmModelId(agentId);
            String title = llmService.generateTitle(conversation.toString(), slmModelId);

            if (StringUtils.isNotBlank(title)) {
                agentChatTitleService.saveOrUpdateTitle(sessionId, title);
                log.info("SuccessSaveSession {} Title: {}", sessionId, title);
                return true;
            }
            return false;
        } catch (Exception e) {
            log.error("GenerateSession {} TitlewhenOccurError: {}", sessionId, e.getMessage());
            return false;
        }
    }

    private String getSlmModelId(String agentId) {
        try {
            if (StringUtils.isBlank(agentId)) {
                return null;
            }

            AgentInfoVO agentInfo = agentService.getAgentById(agentId);
            if (agentInfo == null) {
                return null;
            }

            String slmModelId = agentInfo.getSlmModelId();
            if (StringUtils.isNotBlank(slmModelId)) {
                log.info("Session {} UseSLMModel: {}", agentId, slmModelId);
                return slmModelId;
            }

            ModelConfigEntity defaultLlmConfig = getDefaultLLMConfig();
            if (defaultLlmConfig != null) {
                log.info("Session {} UseDefaultLLMModel: {}", agentId, defaultLlmConfig.getId());
                return defaultLlmConfig.getId();
            }

            String llmModelId = agentInfo.getLlmModelId();
            log.info("Session {} UseLLMModel(Final fallback): {}", agentId, llmModelId);
            return llmModelId;
        } catch (Exception e) {
            log.error("Get agentslmModelIDFail，agentId: {}, Error: {}", agentId, e.getMessage());
            return null;
        }
    }

    private ModelConfigEntity getDefaultLLMConfig() {
        try {
            List<ModelConfigEntity> llmConfigs = modelConfigService.getEnabledModelsByType("LLM");
            if (llmConfigs == null || llmConfigs.isEmpty()) {
                return null;
            }

            for (ModelConfigEntity config : llmConfigs) {
                if (config.getIsDefault() != null && config.getIsDefault() == 1) {
                    return config;
                }
            }

            return llmConfigs.get(0);
        } catch (Exception e) {
            log.error("GetDefaultLLMConfigurationFail: {}", e.getMessage());
            return null;
        }
    }

    /**
     * According toSession IDGetChat history
     */
    private List<AgentChatHistoryDTO> getChatHistoryBySessionId(String sessionId) {
        try {
            // HereNeedneedAccording tosessionIdGetChat history
            // Because existinghasInterfaceNeedneedagentId，mepluralNeedneedfirstFoundAssociateagentId
            String agentId = findAgentIdBySessionId(sessionId);
            if (StringUtils.isBlank(agentId)) {
                return null;
            }
            return agentChatHistoryService.getChatHistoryBySessionId(agentId, sessionId);
        } catch (Exception e) {
            log.error("GetSession {} Chat historyFail: {}", sessionId, e.getMessage());
            return null;
        }
    }

    /**
     * According toSession IDFindAssociateAgentID
     */
    private String findAgentIdBySessionId(String sessionId) {
        try {
            // Query first record of this session to obtainagentId
            QueryWrapper<AgentChatHistoryEntity> wrapper = new QueryWrapper<>();
            wrapper.select("agent_id")
                    .eq("session_id", sessionId)
                    .last("LIMIT 1");

            AgentChatHistoryEntity entity = agentChatHistoryService.getOne(wrapper);
            return entity != null ? entity.getAgentId() : null;
        } catch (Exception e) {
            log.error("According toSession ID {} FindAgentIDFail: {}", sessionId, e.getMessage());
            return null;
        }
    }

    /**
     * fromSessioninGet agentID
     */
    private String getAgentIdFromSession(String sessionId, List<AgentChatHistoryDTO> chatHistory) {
        // Query agent directly from databaseID
        return findAgentIdBySessionId(sessionId);
    }

    /**
     * ExtracthasMeaningforvoiceContent（onlyExtractUserMessage，sortexceptAIReply）
     */
    private List<String> extractMeaningfulMessages(List<AgentChatHistoryDTO> chatHistory) {
        List<String> meaningfulMessages = new ArrayList<>();

        for (AgentChatHistoryDTO message : chatHistory) {
            // onlyProcessUserMessage（chatType = 1）
            if (message.getChatType() != null && message.getChatType() == 1) {
                String content = extractContentFromMessage(message);
                if (isMeaningfulMessage(content)) {
                    meaningfulMessages.add(content);
                }
            }
        }

        return meaningfulMessages;
    }

    /**
     * fromMessageinExtractContent（ProcessJSONFormat）
     */
    private String extractContentFromMessage(AgentChatHistoryDTO message) {
        String content = message.getContent();
        if (StringUtils.isBlank(content)) {
            return "";
        }

        // ProcessJSONFormatContent（With previoussideChatHistoryDialog.vueLogicConsistent）
        Matcher matcher = JSON_PATTERN.matcher(content);
        if (matcher.find()) {
            String jsonContent = matcher.group();
            // SimplifyProcess：ExtractJSONindocthisContent
            return extractTextFromJson(jsonContent);
        }

        return content;
    }

    /**
     * fromJSONinExtract textthisContent
     */
    private String extractTextFromJson(String jsonContent) {
        // SimplifyProcess：Extract"content"FieldValue
        Pattern contentPattern = Pattern.compile("\"content\"\s*:\s*\"([^\"]*)\"");
        Matcher matcher = contentPattern.matcher(jsonContent);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return jsonContent;
    }

    /**
     * Determine whether message is meaningful
     */
    private boolean isMeaningfulMessage(String content) {
        if (StringUtils.isBlank(content)) {
            return false;
        }

        // sortexceptDeviceControlInformation
        if (DEVICE_CONTROL_PATTERN.matcher(content).find()) {
            return false;
        }

        // Exclude irrelevant content like date and weather
        if (WEATHER_PATTERN.matcher(content).find() || DATE_PATTERN.matcher(content).find()) {
            return false;
        }

        // Exclude messages that are too short
        return content.length() >= 5;
    }

    /**
     * fromMessageGenerateSummary
     */
    private String generateSummaryFromMessages(List<String> messages, String agentId) {
        if (messages.isEmpty()) {
            return "This dialogue is short, with no important information to summarize.";
        }

        // BuildCompleteforvoiceContent
        StringBuilder conversation = new StringBuilder();
        for (int i = 0; i < messages.size(); i++) {
            conversation.append("Message").append(i + 1).append(": ").append(messages.get(i)).append("\n");
        }

        try {
            // Get current agent's historical memory
            String historyMemory = getCurrentAgentMemory(agentId);

            // CallLLMServicePerformIntelligentSummary，PassagentIdwithGetCorrectModel configuration
            String summary = callJavaLLMForSummaryWithHistory(conversation.toString(), historyMemory, agentId);

            // ApplicationSummaryRule：LimitMaximumLength
            if (summary.length() > MAX_SUMMARY_LENGTH) {
                summary = summary.substring(0, MAX_SUMMARY_LENGTH) + "...";
            }

            return summary;
        } catch (Exception e) {
            log.error("CallJavasideLLMServiceFail: {}", e.getMessage());
            throw new RuntimeException("LLM service unavailable, unable to generate chat summary");
        }
    }

    /**
     * Get current agent's historical memory
     */
    private String getCurrentAgentMemory(String agentId) {
        try {
            if (StringUtils.isBlank(agentId)) {
                return null;
            }

            // Get agentInformation
            AgentInfoVO agentInfo = agentService.getAgentById(agentId);
            if (agentInfo == null) {
                return null;
            }

            // Returns current summary memory of agent
            return agentInfo.getSummaryMemory();
        } catch (Exception e) {
            log.error("Failed to get agent historical memory，agentId: {}, Error: {}", agentId, e.getMessage());
            return null;
        }
    }

    /**
     * CallJavasideLLMServicePerformIntelligentSummary（SupportHistorical memory merge）
     */
    private String callJavaLLMForSummaryWithHistory(String conversation, String historyMemory, String agentId) {
        try {
            String modelId = getSlmModelId(agentId);

            if (StringUtils.isBlank(modelId)) {
                log.info("Not foundSLMModel，UseDefaultLLMService");
                return llmService.generateSummaryWithHistory(conversation, historyMemory, null, null);
            }

            String summary = llmService.generateSummaryWithHistory(conversation, historyMemory, null, modelId);

            if (StringUtils.isNotBlank(summary) && !summary.equals("Service temporarily unavailable") && !summary.equals("Summary generation failed")) {
                return summary;
            }

            throw new RuntimeException("Java LLM service returned exception: " + summary);

        } catch (Exception e) {
            log.error("CallJavasideLLMServiceException，agentId: {}, Error: {}", agentId, e.getMessage());
            throw e;
        }
    }

    /**
     * CallJavasideLLMServicePerformIntelligentSummary
     */
    private String callJavaLLMForSummary(String conversation, String agentId) {
        try {
            String modelId = getSlmModelId(agentId);

            if (StringUtils.isBlank(modelId)) {
                log.info("Not foundSLMModel，UseDefaultLLMService");
                return llmService.generateSummary(conversation);
            }

            String summary = llmService.generateSummaryWithModel(conversation, modelId);

            if (StringUtils.isNotBlank(summary) && !summary.equals("Service temporarily unavailable") && !summary.equals("Summary generation failed")) {
                return summary;
            }

            throw new RuntimeException("Java LLM service returned exception: " + summary);

        } catch (Exception e) {
            log.error("CallJavasideLLMServiceException，agentId: {}, Error: {}", agentId, e.getMessage());
            throw e;
        }
    }

    /**
     * GetMemorySummaryLLMModelID
     */
    private String getMemorySummaryModelId(String agentId) {
        try {
            if (StringUtils.isBlank(agentId)) {
                return null;
            }

            // Get agentInformation
            AgentInfoVO agentInfo = agentService.getAgentById(agentId);
            if (agentInfo == null) {
                return null;
            }

            // Get agentMemory modelID
            String memModelId = agentInfo.getMemModelId();
            if (StringUtils.isBlank(memModelId)) {
                return null;
            }

            // GetMemory modelConfiguration
            ModelConfigEntity memModelConfig = modelConfigService.getModelByIdFromCache(memModelId);
            if (memModelConfig == null || memModelConfig.getConfigJson() == null) {
                return null;
            }

            // Extract corresponding from memory model configurationLLMModelID
            Map<String, Object> configMap = memModelConfig.getConfigJson();
            String llmModelId = (String) configMap.get("llm");

            if (StringUtils.isBlank(llmModelId)) {
                // If memory model does not configure independentLLM，thenUseAgentDefaultLLMModel
                return agentInfo.getLlmModelId();
            }

            return llmModelId;
        } catch (Exception e) {
            log.error("GetMemorySummaryLLMModelIDFail，agentId: {}, Error: {}", agentId, e.getMessage());
            return null;
        }
    }

    /**
     * According toSession IDGetDeviceInformation
     */
    private DeviceEntity getDeviceBySessionId(String sessionId) {
        try {
            // Query first record of this session to obtainmacAddress
            QueryWrapper<AgentChatHistoryEntity> wrapper = new QueryWrapper<>();
            wrapper.select("mac_address")
                    .eq("session_id", sessionId)
                    .last("LIMIT 1");

            AgentChatHistoryEntity entity = agentChatHistoryService.getOne(wrapper);
            if (entity != null && StringUtils.isNotBlank(entity.getMacAddress())) {
                return deviceService.getDeviceByMacAddress(entity.getMacAddress());
            }
            return null;
        } catch (Exception e) {
            log.error("According toSession ID {} Find deviceInformationFail: {}", sessionId, e.getMessage());
            return null;
        }
    }
}
