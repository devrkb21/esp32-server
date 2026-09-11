package xiaozhi.modules.agent.service;

import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.agent.dto.AgentCreateDTO;
import xiaozhi.modules.agent.dto.AgentDTO;
import xiaozhi.modules.agent.dto.AgentMemoryDTO;
import xiaozhi.modules.agent.dto.AgentUpdateDTO;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.agent.vo.AgentInfoVO;

/**
 * AgenttableProcessservice
 *
 * @author Goody
 * @version 1.0, 2025/4/30
 * @since 1.0.0
 */
public interface AgentService extends BaseService<AgentEntity> {
    /**
     * GetAdministratorAgent list
     *
     * @param params QueryParameter
     * @return Pagination data
     */
    PageData<AgentEntity> adminAgentList(Map<String, Object> params);

    /**
     * According toIDGet agent
     *
     * @param id AgentID
     * @return AgentEntity
     */
    AgentInfoVO getAgentById(String id);

    /**
     * According toIDGet agents accessible to current user
     *
     * @param id     AgentID
     * @param userId CurrentUser ID
     * @return AgentEntity
     */
    AgentInfoVO getAgentById(String id, Long userId);

    /**
     * InsertAgent
     *
     * @param entity AgentEntity
     * @return WhetherSuccess
     */
    boolean insert(AgentEntity entity);

    /**
     * According toUser IDDeleteAgent
     *
     * @param userId User ID
     */
    void deleteAgentByUserId(Long userId);

    /**
     * Delete agent and its associated data
     *
     * @param agentId AgentID
     */
    void deleteAgent(String agentId);

    /**
     * Get userAgent list
     *
     * @param userId User ID
     * @param keyword SearchKeyword
     * @param searchType SearchType（name - byNameSearch，mac - byMACAddressSearch）
     * @return Agent list
     */
    List<AgentDTO> getUserAgents(Long userId, String keyword, String searchType);

    /**
     * According toAgentIDGetDevice count
     *
     * @param agentId AgentID
     * @return Device count
     */
    Integer getDeviceCountByAgentId(String agentId);

    /**
     * According toDeviceMACaddress to query default agent information of corresponding device
     *
     * @param macAddress DeviceMACAddress
     * @return Default agentInformation，Does not existwhenReturnnull
     */
    AgentEntity getDefaultAgentByMacAddress(String macAddress);

    /**
     * Check whether user has permission to access agent
     *
     * @param agentId AgentID
     * @param userId  User ID
     * @return WhetherhasPermission
     */
    boolean checkAgentPermission(String agentId, Long userId);

    /**
     * UpdateAgent
     *
     * @param agentId AgentID
     * @param dto     UpdateAgentallNeedInformation
     */
    void updateAgentById(String agentId, AgentUpdateDTO dto);

    /**
     * Update agent accessible to current user
     *
     * @param agentId AgentID
     * @param dto     UpdateAgentallNeedInformation
     * @param userId  CurrentUser ID
     */
    void updateAgentById(String agentId, AgentUpdateDTO dto, Long userId);

    /**
     * According toDeviceMACaddress to update agent memory accessible to current user
     *
     * @param macAddress DeviceMACAddress
     * @param dto        Agent memory
     * @param userId     CurrentUser ID
     */
    void updateAgentMemoryByDeviceMacAddress(String macAddress, AgentMemoryDTO dto, Long userId);

    /**
     * Delete agent accessible to current user
     *
     * @param agentId AgentID
     * @param userId  CurrentUser ID
     */
    void deleteAgentById(String agentId, Long userId);

    /**
     * UpdateAgent
     *
     * @param agentId        AgentID
     * @param dto            UpdateAgentallNeedInformation
     * @param createSnapshot WhetherCreateConfigurationSnapshot
     */
    void updateAgentById(String agentId, AgentUpdateDTO dto, boolean createSnapshot);

    /**
     * CreateAgent
     *
     * @param dto CreateAgentallNeedInformation
     * @return CreateAgentID
     */
    String createAgent(AgentCreateDTO dto);


}
