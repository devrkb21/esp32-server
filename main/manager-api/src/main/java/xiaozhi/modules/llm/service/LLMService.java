package xiaozhi.modules.llm.service;

/**
 * LLMService interface
 * Supports multiple LLM invocations
 */
public interface LLMService {

    /**
     * Generate chat record summary
     * 
     * @param conversation   forvoiceContent
     * @param promptTemplate Prompt wordTemplate
     * @return SummaryResult
     */
    String generateSummary(String conversation, String promptTemplate);

    /**
     * Generate chat record summary（UseDefaultPrompt word）
     * 
     * @param conversation forvoiceContent
     * @return SummaryResult
     */
    String generateSummary(String conversation);

    /**
     * Generate chat record summary（SpecifyModelID）
     * 
     * @param conversation forvoiceContent
     * @param modelId      ModelID
     * @return SummaryResult
     */
    String generateSummaryWithModel(String conversation, String modelId);

    /**
     * Generate chat record summary（SpecifyModelIDandPrompt wordTemplate）
     * 
     * @param conversation   forvoiceContent
     * @param promptTemplate Prompt wordTemplate
     * @param modelId        ModelID
     * @return SummaryResult
     */
    String generateSummary(String conversation, String promptTemplate, String modelId);

    /**
     * Generate chat record summary（ContainHistorical memory merge）
     * 
     * @param conversation   forvoiceContent
     * @param historyMemory  Historical memory
     * @param promptTemplate Prompt wordTemplate
     * @param modelId        ModelID
     * @return SummaryResult
     */
    String generateSummaryWithHistory(String conversation, String historyMemory, String promptTemplate, String modelId);

    /**
     * Check whether service is available
     * 
     * @return WhetherAvailable
     */
    boolean isAvailable();

    /**
     * Check whether service for specified model is available
     * 
     * @param modelId ModelID
     * @return WhetherAvailable
     */
    boolean isAvailable(String modelId);

    /**
     * GenerateSession title
     * 
     * @param conversation forvoiceContent
     * @param modelId      ModelID
     * @return Title（approx15char）
     */
    String generateTitle(String conversation, String modelId);
}