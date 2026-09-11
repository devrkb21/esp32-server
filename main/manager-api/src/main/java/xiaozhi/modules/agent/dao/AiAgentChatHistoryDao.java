package xiaozhi.modules.agent.dao;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;

import xiaozhi.modules.agent.entity.AgentChatHistoryEntity;

/**
 * {@link AgentChatHistoryEntity} AgentChat historyRecordDaoObject
 *
 * @author Goody
 * @version 1.0, 2025/4/30
 * @since 1.0.0
 */
@Mapper
public interface AiAgentChatHistoryDao extends BaseMapper<AgentChatHistoryEntity> {

    /**
     * According toAgentIDDeleteChat historyRecord
     *
     * @param agentId AgentID
     */
    void deleteHistoryByAgentId(String agentId);

    /**
     * According toAgentIDDeleteAudioID
     *
     * @param agentId AgentID
     */
    void deleteAudioIdByAgentId(String agentId);

    /**
     * According toAgentIDGetallHas audioIDList
     *
     * @param agentId AgentID
     * @return AudioIDList
     */
    List<String> getAudioIdsByAgentId(String agentId);

    /**
     * Batch deleteAudio
     *
     * @param audioIds AudioIDList
     */
    void deleteAudioByIds(@Param("audioIds") List<String> audioIds);
}
