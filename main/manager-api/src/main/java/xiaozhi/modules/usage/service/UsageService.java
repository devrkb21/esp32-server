package xiaozhi.modules.usage.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import xiaozhi.modules.usage.dto.UsageReportDTO;

/**
 * AI usage metering and the daily LLM quota.
 */
public interface UsageService {
    /**
     * Stores a batch from xiaozhi-server (rows add up per day, robot and model).
     *
     * @return {"accepted": n, "users": {userId: LLM requests on the newest reported day}}
     */
    Map<String, Object> report(List<UsageReportDTO.Row> rows);

    /** The usage page of the back office for a day range (both ends included). */
    Map<String, Object> summary(LocalDate from, LocalDate to);

    /** One owner's quota today: {limit, used, remaining, exceeded, blocked, date}. */
    Map<String, Object> quota(Long userId);

    /** Today in the server's local time (sys param server.timezone_offset, default +6). */
    LocalDate today();

    /** Daily LLM request limit per user (0: unlimited). */
    int dailyLimit();

    /** LLM requests of an owner on a day. */
    long usedOn(Long userId, LocalDate day);
}
