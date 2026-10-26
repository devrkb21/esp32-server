package xiaozhi.modules.summary.controller;

import java.util.List;
import java.util.Map;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.security.user.SecurityUser;
import xiaozhi.modules.summary.service.SummaryService;

/**
 * A robot's daily summaries (docs/family-and-notifications.md).
 */
@Tag(name = "Daily summary")
@RestController
@RequestMapping("/summary")
public class SummaryController {
    private final SummaryService summaryService;

    public SummaryController(SummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @GetMapping("/device/{deviceId}")
    @Operation(summary = "The robot's last days, newest first")
    @RequiresPermissions("sys:role:normal")
    public Result<List<Map<String, Object>>> list(@PathVariable String deviceId,
            @RequestParam(value = "days", defaultValue = "30") int days) {
        return new Result<List<Map<String, Object>>>()
                .ok(summaryService.list(deviceId, SecurityUser.getUserId(), days));
    }

    @PostMapping("/device/{deviceId}/build")
    @Operation(summary = "Build today's summary now")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> build(@PathVariable String deviceId) {
        return new Result<Map<String, Object>>().ok(summaryService.buildNow(deviceId, SecurityUser.getUserId()));
    }
}
