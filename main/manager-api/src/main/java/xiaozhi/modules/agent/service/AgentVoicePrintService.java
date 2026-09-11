package xiaozhi.modules.agent.service;

import java.util.List;

import xiaozhi.modules.agent.dto.AgentVoicePrintSaveDTO;
import xiaozhi.modules.agent.dto.AgentVoicePrintUpdateDTO;
import xiaozhi.modules.agent.vo.AgentVoicePrintVO;

/**
 * AgentVoiceprintProcessservice
 *
 * @author zjy
 */
public interface AgentVoicePrintService {
    /**
     * AddAgentNewVoiceprint
     *
     * @param dto SaveAgentVoiceprintData
     * @return T:Success F：Fail
     */
    boolean insert(AgentVoicePrintSaveDTO dto);

    /**
     * DeleteAgentindicateVoiceprint
     *
     * @param userId       CurrentLoginUserid
     * @param voicePrintId Voiceprintid
     * @return WhetherSuccess T:Success F：Fail
     */
    boolean delete(Long userId, String voicePrintId);

    /**
     * Get all voiceprint data for specified agent
     *
     * @param userId  CurrentLoginUserid
     * @param agentId Agentid
     * @return Voiceprint dataCollection
     */
    List<AgentVoicePrintVO> list(Long userId, String agentId);

    /**
     * Update specified voiceprint data of agent
     *
     * @param userId CurrentLoginUserid
     * @param dto    UpdateVoiceprintData
     * @return WhetherSuccess T:Success F：Fail
     */
    boolean update(Long userId, AgentVoicePrintUpdateDTO dto);

}
