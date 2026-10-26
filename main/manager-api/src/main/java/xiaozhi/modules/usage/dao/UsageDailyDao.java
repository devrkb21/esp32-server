package xiaozhi.modules.usage.dao;

import java.util.List;
import java.util.Map;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import xiaozhi.common.dao.BaseDao;
import xiaozhi.modules.usage.entity.UsageDailyEntity;

/**
 * Daily usage rows. Reports add to the row of (day, robot, model type, model).
 */
@Mapper
public interface UsageDailyDao extends BaseDao<UsageDailyEntity> {

    @Insert("INSERT INTO ai_usage_daily (usage_date, mac_address, user_id, agent_id, model_type, model_id, "
            + "llm_requests, prompt_tokens, completion_tokens, asr_seconds, tts_chars, quota_blocked, update_date) "
            + "VALUES (#{e.usageDate}, #{e.macAddress}, #{e.userId}, #{e.agentId}, #{e.modelType}, #{e.modelId}, "
            + "#{e.llmRequests}, #{e.promptTokens}, #{e.completionTokens}, #{e.asrSeconds}, #{e.ttsChars}, #{e.quotaBlocked}, NOW()) "
            + "ON DUPLICATE KEY UPDATE llm_requests = llm_requests + VALUES(llm_requests), "
            + "prompt_tokens = prompt_tokens + VALUES(prompt_tokens), "
            + "completion_tokens = completion_tokens + VALUES(completion_tokens), "
            + "asr_seconds = asr_seconds + VALUES(asr_seconds), tts_chars = tts_chars + VALUES(tts_chars), "
            + "quota_blocked = quota_blocked + VALUES(quota_blocked), "
            + "user_id = COALESCE(VALUES(user_id), user_id), agent_id = COALESCE(VALUES(agent_id), agent_id), update_date = NOW()")
    int upsert(@Param("e") UsageDailyEntity e);

    @Select("SELECT COALESCE(SUM(llm_requests), 0) FROM ai_usage_daily WHERE user_id = #{userId} AND usage_date = #{day}")
    long llmRequestsOfUser(@Param("userId") Long userId, @Param("day") String day);

    @Select("SELECT COALESCE(SUM(quota_blocked), 0) FROM ai_usage_daily WHERE user_id = #{userId} AND usage_date = #{day}")
    long quotaBlockedOfUser(@Param("userId") Long userId, @Param("day") String day);

    String SUMS = "COALESCE(SUM(x.llm_requests), 0) AS llmRequests, COALESCE(SUM(x.prompt_tokens), 0) AS promptTokens, "
            + "COALESCE(SUM(x.completion_tokens), 0) AS completionTokens, COALESCE(SUM(x.asr_seconds), 0) AS asrSeconds, "
            + "COALESCE(SUM(x.tts_chars), 0) AS ttsChars, COALESCE(SUM(x.quota_blocked), 0) AS quotaBlocked";

    /** Sums per day and model, for the day series and the model table. */
    @Select("SELECT DATE_FORMAT(x.usage_date, '%Y-%m-%d') AS day, x.model_type AS modelType, x.model_id AS modelId, " + SUMS
            + " FROM ai_usage_daily x WHERE x.usage_date BETWEEN #{from} AND #{to}"
            + " GROUP BY x.usage_date, x.model_type, x.model_id ORDER BY x.usage_date")
    List<Map<String, Object>> byDayAndModel(@Param("from") String from, @Param("to") String to);

    /** Sums per robot and model with the owner, for the user and robot tables. */
    @Select("SELECT x.mac_address AS macAddress, x.user_id AS userId, MAX(su.username) AS username, MAX(d.alias) AS alias, "
            + "x.model_type AS modelType, x.model_id AS modelId, " + SUMS
            + " FROM ai_usage_daily x LEFT JOIN sys_user su ON su.id = x.user_id"
            + " LEFT JOIN ai_device d ON d.mac_address = x.mac_address"
            + " WHERE x.usage_date BETWEEN #{from} AND #{to}"
            + " GROUP BY x.mac_address, x.user_id, x.model_type, x.model_id")
    List<Map<String, Object>> byRobotAndModel(@Param("from") String from, @Param("to") String to);
}
