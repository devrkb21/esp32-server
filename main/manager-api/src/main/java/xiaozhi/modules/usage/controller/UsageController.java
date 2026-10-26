package xiaozhi.modules.usage.controller;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.security.user.SecurityUser;
import xiaozhi.modules.usage.service.UsageService;

/**
 * Usage and cost (back office) and the signed-in owner's daily quota (apps).
 */
@RestController
@RequestMapping("/usage")
@Tag(name = "Usage and quotas")
@AllArgsConstructor
public class UsageController {
    private final UsageService usageService;

    private static LocalDate day(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    @GetMapping("/summary")
    @Operation(summary = "Usage and estimated cost per day, model, user and robot (super admin)")
    @RequiresPermissions("sys:role:superAdmin")
    public Result<Map<String, Object>> summary(
            @Parameter(description = "First day, yyyy-MM-dd (default: 6 days before to)") @RequestParam(required = false) String from,
            @Parameter(description = "Last day, yyyy-MM-dd (default: today)") @RequestParam(required = false) String to) {
        LocalDate end = day(to);
        if (end == null) {
            end = usageService.today();
        }
        LocalDate start = day(from);
        if (start == null) {
            start = end.minusDays(6);
        }
        return new Result<Map<String, Object>>().ok(usageService.summary(start, end));
    }

    @GetMapping("/quota")
    @Operation(summary = "The signed-in owner's LLM requests today against the daily limit")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> quota() {
        return new Result<Map<String, Object>>().ok(usageService.quota(SecurityUser.getUserId()));
    }
}
