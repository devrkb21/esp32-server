package xiaozhi.modules.agent.service.impl;

import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import cn.hutool.crypto.digest.DigestUtil;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.constant.Constant;
import xiaozhi.common.utils.AESUtils;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.agent.Enums.XiaoZhiMcpJsonRpcJson;
import xiaozhi.modules.agent.service.AgentMcpAccessPointService;
import xiaozhi.modules.sys.service.SysParamsService;
import xiaozhi.modules.sys.utils.WebSocketClientManager;

@AllArgsConstructor
@Service
@Slf4j
public class AgentMcpAccessPointServiceImpl implements AgentMcpAccessPointService {
    private SysParamsService sysParamsService;

    @Override
    public String getAgentMcpAccessAddress(String id) {
        // GettomcpAddress
        String url = sysParamsService.getValue(Constant.SERVER_MCP_ENDPOINT, true);
        if (StringUtils.isBlank(url) || "null".equals(url)) {
            return null;
        }
        URI uri = getURI(url);
        // Get agentmcpurlPrefix
        String agentMcpUrl = getAgentMcpUrl(uri);
        // GetSecret key
        String key = getSecretKey(uri);
        // GetEncrypttoken
        String encryptToken = encryptToken(id, key);
        // fortokenPerformURLCode
        String encodedToken = URLEncoder.encode(encryptToken, StandardCharsets.UTF_8);
        // ReturnAgentMcpPathFormat
        agentMcpUrl = "%s/mcp/?token=%s".formatted(agentMcpUrl, encodedToken);
        return agentMcpUrl;
    }

    @Override
    public List<String> getAgentMcpToolsList(String id) {
        String wsUrl = getAgentMcpAccessAddress(id);
        if (StringUtils.isBlank(wsUrl)) {
            return List.of();
        }

        //  /mcp Replaceas /call
        wsUrl = wsUrl.replace("/mcp/", "/call/");

        try {
            // Create WebSocket Connection，addAdd timeoutwhenwhenbetweento15s
            try (WebSocketClientManager client = WebSocketClientManager.build(
                    new WebSocketClientManager.Builder()
                            .uri(wsUrl)
                            .bufferSize(1024 * 1024)
                            .connectTimeout(8, TimeUnit.SECONDS)
                            .maxSessionDuration(10, TimeUnit.SECONDS))) {

                // Step1: Send initialization message and wait for response
                log.info("SendMCPInitializeMessage，AgentID: {}", id);
                client.sendText(XiaoZhiMcpJsonRpcJson.getInitializeJson());

                // etcpendingInitializeResponse (id=1) - moveexceptFixedDelay，modifyasResponseDrive
                List<String> initResponses = client.listenerWithoutClose(response -> {
                    try {
                        Map<String, Object> jsonMap = JsonUtils.parseMap(response);
                        if (jsonMap != null && Integer.valueOf(1).equals(jsonMap.get("id"))) {
                            // CheckWhetherhasresultField，RepresentsInitializeSuccess
                            return jsonMap.containsKey("result") && !jsonMap.containsKey("error");
                        }
                        return false;
                    } catch (Exception e) {
                        log.warn("ParseInitializeResponseFail: {}", response, e);
                        return false;
                    }
                });

                // VerifyInitializeResponse
                boolean initSucceeded = false;
                for (String response : initResponses) {
                    try {
                        Map<String, Object> jsonMap = JsonUtils.parseMap(response);
                        if (jsonMap != null && Integer.valueOf(1).equals(jsonMap.get("id"))) {
                            if (jsonMap.containsKey("result")) {
                                log.info("MCPInitializeSuccess，AgentID: {}", id);
                                initSucceeded = true;
                                break;
                            } else if (jsonMap.containsKey("error")) {
                                log.error("MCPInitializeFail，AgentID: {}, Error: {}", id, jsonMap.get("error"));
                                return List.of();
                            }
                        }
                    } catch (Exception e) {
                        log.warn("ProcessInitializeResponseFail: {}", response, e);
                    }
                }

                if (!initSucceeded) {
                    log.error("notreceivetohaseffectMCPInitializeResponse，AgentID: {}", id);
                    return List.of();
                }

                // Step2: SendInitializeCompleteNotification - onlyhasatreceivetoinitializeResponseOnly afterSend
                log.info("SendMCPInitializeCompleteNotification，AgentID: {}", id);
                client.sendText(XiaoZhiMcpJsonRpcJson.getNotificationsInitializedJson());
                // Step3: SendTool listRequest - ImmediatelySend，withoutNeedExtra latency
                log.info("SendMCPTool listRequest，AgentID: {}", id);
                client.sendText(XiaoZhiMcpJsonRpcJson.getToolsListJson());

                // etcpendingTool listResponse (id=2)
                List<String> toolsResponses = client.listener(response -> {
                    try {
                        Map<String, Object> jsonMap = JsonUtils.parseMap(response);
                        return jsonMap != null && Integer.valueOf(2).equals(jsonMap.get("id"));
                    } catch (Exception e) {
                        log.warn("ParseTool listResponseFail: {}", response, e);
                        return false;
                    }
                });

                // ProcessTool listResponse
                for (String response : toolsResponses) {
                    try {
                        Map<String, Object> jsonMap = JsonUtils.parseMap(response);
                        if (jsonMap != null && Integer.valueOf(2).equals(jsonMap.get("id"))) {
                            // CheckWhetherhasresultField
                            Object resultObj = jsonMap.get("result");
                            if (resultObj instanceof Map<?, ?>) {
                                Map<String, Object> resultMap = JsonUtils.toStringObjectMap(resultObj);
                                Object toolsObj = resultMap.get("tools");
                                if (toolsObj instanceof List<?>) {
                                    List<Map<String, Object>> toolsList = JsonUtils.toStringObjectMapList(toolsObj);
                                    // ExtractToolNameList
                                    List<String> result = toolsList.stream()
                                            .map(tool -> String.class.cast(tool.get("name")))
                                            .filter(name -> name != null)
                                            .sorted()
                                            .collect(Collectors.toList());
                                    log.info("SuccessGetMCPTool list，AgentID: {}, ToolCount: {}", id, result.size());
                                    return result;
                                }
                            } else if (jsonMap.containsKey("error")) {
                                log.error("GetTool listFail，AgentID: {}, Error: {}", id, jsonMap.get("error"));
                                return List.of();
                            }
                        }
                    } catch (Exception e) {
                        log.warn("ProcessTool listResponseFail: {}", response, e);
                    }
                }

                log.warn("No valid tool list response found，AgentID: {}", id);
                return List.of();

            }
        } catch (Exception e) {
            log.error("Get agent MCP Tool listFail，AgentID: {},Errororiginalcause：{}", id, e.getMessage());
            return List.of();
        }
    }

    /**
     * GetURIObject
     * 
     * @param url Path
     * @return URIObject
     */
    private static URI getURI(String url) {
        try {
            return new URI(url);
        } catch (URISyntaxException e) {
            log.error("PathFormatnotCorrectPath：{}，\nErrorInformation:{}", url, e.getMessage());
            throw new RuntimeException("mcpAddressExistsError，pleaseEnterParameter managementUpdatemcpEndpoint address");
        }
    }

    /**
     * GetSecret key
     *
     * @param uri mcpAddress
     * @return Secret key
     */
    private static String getSecretKey(URI uri) {
        // GetParameter
        String query = uri.getQuery();
        // GetaesEncryptSecret key
        String str = "key=";
        return query.substring(query.indexOf(str) + str.length());
    }

    /**
     * Get agentmcpAccess pointurl
     *
     * @param uri mcpAddress
     * @return AgentmcpAccess pointurl
     */
    private String getAgentMcpUrl(URI uri) {
        // GetProtocol
        String wsScheme = (uri.getScheme().equals("https")) ? "wss" : "ws";
        // GetHost，sideport，Path
        String path = uri.getSchemeSpecificPart();
        // GettoLastOne/beforepath
        path = path.substring(0, path.lastIndexOf("/"));
        return wsScheme + ":" + path;
    }

    /**
     * GetforAgentidEncrypttoken
     *
     * @param agentId Agentid
     * @param key     EncryptSecret key
     * @return Encryptedtoken
     */
    private static String encryptToken(String agentId, String key) {
        // Usemd5forAgentidPerformEncrypt
        String md5 = DigestUtil.md5Hex(agentId);
        // aesNeedneedEncryptdocthis
        String json = "{\"agentId\": \"%s\"}".formatted(md5);
        // EncryptedbecometokenValue
        return AESUtils.encrypt(key, json);
    }
}
