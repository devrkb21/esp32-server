package xiaozhi.modules.stats.service;

import xiaozhi.modules.stats.vo.DailyUsageVO;
import xiaozhi.modules.stats.vo.StatsSummaryVO;

public interface StatsService {
    /**
     * Get aggregate statistics summary for the specified user
     *
     * @param userId Current User ID
     * @return StatsSummaryVO
     */
    StatsSummaryVO getSummary(Long userId);

    /**
     * Get daily / 24-hour time series usage trends and top device/agent rankings
     *
     * @param userId Current User ID
     * @return DailyUsageVO
     */
    DailyUsageVO getDailyUsage(Long userId);
}
