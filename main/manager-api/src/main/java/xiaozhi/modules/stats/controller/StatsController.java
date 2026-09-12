package xiaozhi.modules.stats.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.security.user.SecurityUser;
import xiaozhi.modules.stats.service.StatsService;
import xiaozhi.modules.stats.vo.DailyUsageVO;
import xiaozhi.modules.stats.vo.StatsSummaryVO;

@Tag(name = "Analytics & Stats Management")
@RequiredArgsConstructor
@RestController
@RequestMapping("/stats")
public class StatsController {

    private final StatsService statsService;

    @GetMapping("/summary")
    @Operation(summary = "Get user analytics summary")
    @RequiresPermissions("sys:role:normal")
    public Result<StatsSummaryVO> getSummary() {
        Long userId = SecurityUser.getUserId();
        StatsSummaryVO summary = statsService.getSummary(userId);
        return new Result<StatsSummaryVO>().ok(summary);
    }

    @GetMapping("/daily-usage")
    @Operation(summary = "Get user daily and 24-hour usage trend")
    @RequiresPermissions("sys:role:normal")
    public Result<DailyUsageVO> getDailyUsage() {
        Long userId = SecurityUser.getUserId();
        DailyUsageVO usage = statsService.getDailyUsage(userId);
        return new Result<DailyUsageVO>().ok(usage);
    }
}
