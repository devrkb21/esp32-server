package xiaozhi.modules.agent.dao;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import org.apache.ibatis.annotations.Select;
import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.agent.vo.AgentInfoVO;

@Mapper
public interface AgentDao extends BaseDao<AgentEntity> {
    /**
     * Get agentDevice count
     * 
     * @param agentId AgentID
     * @return Device count
     */
    Integer getDeviceCountByAgentId(@Param("agentId") String agentId);

    /**
     * According toDeviceMACaddress to query default agent information of corresponding device
     *
     * @param macAddress DeviceMACAddress
     * @return Default agentInformation
     */
    @Select(" SELECT a.* FROM ai_device d " +
            " LEFT JOIN ai_agent a ON d.agent_id = a.id " +
            " WHERE d.mac_address = #{macAddress} " +
            " ORDER BY d.id DESC LIMIT 1")
    AgentEntity getDefaultAgentByMacAddress(@Param("macAddress") String macAddress);

    /**
     * According toidQueryagentInformation，IncludePluginInformation
     *
     * @param agentId AgentID
     */
    AgentInfoVO selectAgentInfoById(@Param("agentId") String agentId);

    /**
     * LockedAgentprimaryRecord，Used to serialize configuration writes for the same agent
     *
     * @param agentId AgentID
     */
    AgentEntity selectByIdForUpdate(@Param("agentId") String agentId);

    /**
     * Accurately write agent fields covered by snapshot，IncludeTargetSnapshotin null Value。
     * notUpdateBelongingUser、Creation information and other fields not belonging to snapshot。
     *
     * @param agent Agent with target snapshot applied
     * @return Affected rows
     */
    int updateSnapshotFields(@Param("agent") AgentEntity agent);
}
