package xiaozhi.modules.agent.service;

/**
 * Agent chat history summary service interface
 */
public interface AgentChatSummaryService {

    /**
     * According toSession IDGenerate chat history summary and save to agent memory
     * 
     * @param sessionId Session ID
     * @return SaveResult
     */
    boolean generateAndSaveChatSummary(String sessionId);

    /**
     * According toSession IDGenerateChatTitleandSave
     *
     * @param sessionId Session ID
     * @return WhetherSuccess
     */
    boolean generateAndSaveChatTitle(String sessionId);
}