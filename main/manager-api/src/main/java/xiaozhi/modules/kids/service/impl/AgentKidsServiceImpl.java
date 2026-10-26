package xiaozhi.modules.kids.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import lombok.AllArgsConstructor;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.kids.dao.AgentKidsDao;
import xiaozhi.modules.kids.dto.AgentKidsDTO;
import xiaozhi.modules.kids.entity.AgentKidsEntity;
import xiaozhi.modules.kids.service.AgentKidsService;

@Service
@AllArgsConstructor
public class AgentKidsServiceImpl implements AgentKidsService {
    private final AgentKidsDao agentKidsDao;

    static AgentKidsDTO fromEntity(AgentKidsEntity e) {
        AgentKidsDTO dto = new AgentKidsDTO();
        if (e == null) {
            return dto;
        }
        dto.setEnabled(e.getEnabled() != null && e.getEnabled() == 1);
        dto.setAge(e.getAge());
        List<String> topics = new ArrayList<>();
        if (StringUtils.isNotBlank(e.getBlockedTopics())) {
            try {
                List<String> parsed = JsonUtils.parseArray(e.getBlockedTopics(), String.class);
                if (parsed != null) {
                    topics.addAll(parsed);
                }
            } catch (Exception ignored) {
                // a broken list reads as empty
            }
        }
        dto.setBlockedTopics(topics);
        return AgentKidsService.clean(dto);
    }

    @Override
    public AgentKidsDTO get(String agentId) {
        return fromEntity(agentKidsDao.selectById(agentId));
    }

    @Override
    public AgentKidsDTO save(String agentId, AgentKidsDTO dto) {
        AgentKidsDTO clean = AgentKidsService.clean(dto);
        AgentKidsEntity e = new AgentKidsEntity();
        e.setAgentId(agentId);
        e.setEnabled(Boolean.TRUE.equals(clean.getEnabled()) ? 1 : 0);
        e.setAge(clean.getAge());
        e.setBlockedTopics(JsonUtils.toJsonString(clean.getBlockedTopics()));
        if (agentKidsDao.selectById(agentId) == null) {
            agentKidsDao.insert(e);
        } else {
            agentKidsDao.updateById(e);
        }
        return clean;
    }

    @Override
    public Map<String, Object> runtimeConfig(String agentId) {
        if (StringUtils.isBlank(agentId)) {
            return null;
        }
        return AgentKidsService.toRuntime(get(agentId));
    }
}
