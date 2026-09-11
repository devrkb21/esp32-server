package xiaozhi.modules.agent.service;


import java.util.List;

/**
 * AgentMcpAccess pointProcessservice
 *
 * @author zjy
 */
public interface AgentMcpAccessPointService {
    /**
     * Get agentmcpEndpoint address
     * @param id Agentid
     * @return mcpEndpoint address
     */
   String getAgentMcpAccessAddress(String id);

    /**
     * Get agentmcpAccess pointalreadyhasTool list
     * @param id Agentid
     * @return Tool list
     */
   List<String> getAgentMcpToolsList(String id);
}
