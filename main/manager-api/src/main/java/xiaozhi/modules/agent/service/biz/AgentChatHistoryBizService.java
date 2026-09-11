package xiaozhi.modules.agent.service.biz;

import xiaozhi.modules.agent.dto.AgentChatHistoryReportDTO;

/**
 * Agent chat history business logic layer
 *
 * @author Goody
 * @version 1.0, 2025/4/30
 * @since 1.0.0
 */
public interface AgentChatHistoryBizService {

    /**
     * Chat reportpartymethod
     *
     * @param agentChatHistoryReportDTO Input object containing information required for chat reporting
     *                                  For example: DeviceMACAddress、FileType、Contentetc
     * @return UploadResult，trueRepresentsSuccess，falseRepresentsFail
     */
    Boolean report(AgentChatHistoryReportDTO agentChatHistoryReportDTO);
}
