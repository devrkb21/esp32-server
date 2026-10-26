package xiaozhi.modules.kids.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import xiaozhi.modules.kids.dto.AgentKidsDTO;

/**
 * Kids mode of characters.
 */
public interface AgentKidsService {
    int MIN_AGE = 3;
    int MAX_AGE = 12;
    int DEFAULT_AGE = 7;
    int MAX_TOPICS = 30;
    int MAX_TOPIC_LEN = 40;

    /** The settings of a character (defaults when it has none). */
    AgentKidsDTO get(String agentId);

    /** Saves the settings (cleaned) and returns what was stored. */
    AgentKidsDTO save(String agentId, AgentKidsDTO dto);

    /** {enabled, age, blocked_topics} for xiaozhi-server, or null when kids mode is off. */
    Map<String, Object> runtimeConfig(String agentId);

    /** Settings cleaned to their limits: age 3-12, topics trimmed, unique, at most 30. */
    static AgentKidsDTO clean(AgentKidsDTO in) {
        AgentKidsDTO out = new AgentKidsDTO();
        if (in == null) {
            return out;
        }
        out.setEnabled(Boolean.TRUE.equals(in.getEnabled()));
        int age = in.getAge() == null ? DEFAULT_AGE : in.getAge();
        out.setAge(Math.max(MIN_AGE, Math.min(MAX_AGE, age)));
        List<String> topics = new ArrayList<>();
        List<String> seen = new ArrayList<>();
        if (in.getBlockedTopics() != null) {
            for (String t : in.getBlockedTopics()) {
                if (t == null) {
                    continue;
                }
                String s = String.join(" ", t.trim().split("\\s+"));
                if (s.length() > MAX_TOPIC_LEN) {
                    s = s.substring(0, MAX_TOPIC_LEN);
                }
                String key = s.toLowerCase(Locale.ROOT);
                if (s.isEmpty() || seen.contains(key)) {
                    continue;
                }
                seen.add(key);
                topics.add(s);
                if (topics.size() >= MAX_TOPICS) {
                    break;
                }
            }
        }
        out.setBlockedTopics(topics);
        return out;
    }

    /** The server block of cleaned settings (null when off). */
    static Map<String, Object> toRuntime(AgentKidsDTO dto) {
        if (dto == null || !Boolean.TRUE.equals(dto.getEnabled())) {
            return null;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enabled", true);
        out.put("age", dto.getAge());
        out.put("blocked_topics", dto.getBlockedTopics());
        return out;
    }
}
