package xiaozhi.modules.usage.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.utils.SpringContextUtils;
import xiaozhi.modules.agent.entity.AgentEntity;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.kids.service.AgentKidsService;
import xiaozhi.modules.model.entity.ModelConfigEntity;
import xiaozhi.modules.model.service.ModelConfigService;
import xiaozhi.modules.sys.service.SysParamsService;

/**
 * What the AI wave adds to the agent config xiaozhi-server fetches (/config/agent-models):
 * <ul>
 * <li>{@code fallback}: {"LLM": [{"id", "config"}...], "ASR": [...]} from the sys params
 * llm.fallback_chain and asr.fallback_chain (enabled models only, the agent's own model left out);</li>
 * <li>{@code kids}: {enabled, age, blocked_topics} of the character, when kids mode is on;</li>
 * <li>{@code usage_quota}: {user_id, llm_daily_limit, llm_used_today} for the owner's daily limit.</li>
 * </ul>
 * ConfigServiceImpl calls {@link #contribute} through the static entry point, so its constructor
 * (and its tests) stay as they are.
 */
@Slf4j
@Component
@AllArgsConstructor
public class AgentRuntimeExtras {
    public static final String LLM_CHAIN_PARAM = "llm.fallback_chain";
    public static final String ASR_CHAIN_PARAM = "asr.fallback_chain";

    private final SysParamsService sysParamsService;
    private final ModelConfigService modelConfigService;
    private final AgentKidsService agentKidsService;
    private final UsageService usageService;

    /** Adds the blocks to an agent config; never fails the config fetch. */
    public static void apply(AgentEntity agent, DeviceEntity device, Map<String, Object> result) {
        try {
            if (SpringContextUtils.applicationContext == null) {
                return;
            }
            SpringContextUtils.getBean(AgentRuntimeExtras.class).contribute(agent, device, result);
        } catch (Exception e) {
            log.warn("AI extras left out of the agent config: {}", e.getMessage());
        }
    }

    public void contribute(AgentEntity agent, DeviceEntity device, Map<String, Object> result) {
        Map<String, Object> fallback = new LinkedHashMap<>();
        List<Map<String, Object>> llm = chain(LLM_CHAIN_PARAM, "LLM", agent.getLlmModelId());
        if (!llm.isEmpty()) {
            fallback.put("LLM", llm);
        }
        List<Map<String, Object>> asr = chain(ASR_CHAIN_PARAM, "ASR", agent.getAsrModelId());
        if (!asr.isEmpty()) {
            fallback.put("ASR", asr);
        }
        if (!fallback.isEmpty()) {
            result.put("fallback", fallback);
        }

        Map<String, Object> kids = agentKidsService.runtimeConfig(agent.getId());
        if (kids != null) {
            result.put("kids", kids);
        }

        Long userId = device == null ? null : device.getUserId();
        if (userId != null) {
            Map<String, Object> quota = new LinkedHashMap<>();
            quota.put("user_id", userId);
            quota.put("llm_daily_limit", usageService.dailyLimit());
            quota.put("llm_used_today", usageService.usedOn(userId, usageService.today()));
            result.put("usage_quota", quota);
        }
    }

    /** The fallback models of one type, in order: enabled, of that type, not the agent's own. */
    List<Map<String, Object>> chain(String param, String type, String ownModelId) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (String id : UsageMath.parseChain(sysParamsService.getValue(param, true))) {
            if (id.equals(ownModelId)) {
                continue;
            }
            ModelConfigEntity model = modelConfigService.getModelByIdFromCache(id);
            if (model == null || model.getConfigJson() == null || !type.equalsIgnoreCase(model.getModelType())
                    || (model.getIsEnabled() != null && model.getIsEnabled() == 0)) {
                log.warn("Fallback model {} skipped (missing, disabled or not {})", id, type);
                continue;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", model.getId());
            item.put("config", model.getConfigJson());
            out.add(item);
        }
        return out;
    }
}
