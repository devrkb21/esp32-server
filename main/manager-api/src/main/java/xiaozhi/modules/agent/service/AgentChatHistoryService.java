package xiaozhi.modules.agent.service;

import java.util.List;
import java.util.Map;

import com.baomidou.mybatisplus.extension.repository.IRepository;

import xiaozhi.common.page.PageData;
import xiaozhi.modules.agent.dto.AgentChatHistoryDTO;
import xiaozhi.modules.agent.dto.AgentChatSessionDTO;
import xiaozhi.modules.agent.entity.AgentChatHistoryEntity;
import xiaozhi.modules.agent.vo.AgentChatHistoryUserVO;

/**
 * AgentChat historytableProcessservice
 *
 * @author Goody
 * @version 1.0, 2025/4/30
 * @since 1.0.0
 */
public interface AgentChatHistoryService extends IRepository<AgentChatHistoryEntity> {

    /**
     * According toAgentIDGetSession list
     *
     * @param params QueryParameter，ContainagentId、page、limit
     * @return PaginationSession list
     */
    PageData<AgentChatSessionDTO> getSessionListByAgentId(Map<String, Object> params);

    /**
     * According toSession IDGetChat historyList
     *
     * @param agentId   AgentID
     * @param sessionId Session ID
     * @return Chat historyList
     */
    List<AgentChatHistoryDTO> getChatHistoryBySessionId(String agentId, String sessionId);

    /**
     * According toSession IDGet agentID
     *
     * @param sessionId Session ID
     * @return AgentID
     */
    String getAgentIdBySessionId(String sessionId);

    /**
     * According toAgentIDDeleteChat history
     *
     * @param agentId     AgentID
     * @param deleteAudio WhetherDeleteAudio
     * @param deleteText  WhetherDeletedocthis
     */
    void deleteByAgentId(String agentId, Boolean deleteAudio, Boolean deleteText);

    /**
     * According toAgentIDGetRecent50itemUserChat historyData（withAudioData）
     *
     * @param agentId Agentid
     * @return Chat historyList（onlyhasUser）
     */
    List<AgentChatHistoryUserVO> getRecentlyFiftyByAgentId(String agentId);

    /**
     * According toAudioDataIDGetChatContent
     *
     * @param audioId Audioid
     * @return ChatContent
     */
    String getContentByAudioId(String audioId);

    /**
     * According toAudioIDGet agentID
     *
     * @param audioId AudioID
     * @return AgentID
     */
    String getAgentIdByAudioId(String audioId);


    /**
     * QuerythisAudioidWhetherBelongs to thisAgent
     *
     * @param audioId Audioid
     * @param agentId Audioid
     * @return T：Belongs to F：notBelongs to
     */
    boolean isAudioOwnedByAgent(String audioId,String agentId);
}
