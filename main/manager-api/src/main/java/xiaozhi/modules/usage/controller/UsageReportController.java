package xiaozhi.modules.usage.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.usage.dto.UsageReportDTO;
import xiaozhi.modules.usage.service.UsageService;

/**
 * xiaozhi-server reports usage here. Under /config/**, so the server secret filter guards it.
 */
@RestController
@RequestMapping("config/usage")
@Tag(name = "Usage report (server)")
@AllArgsConstructor
public class UsageReportController {
    private final UsageService usageService;

    @PostMapping("report")
    @Operation(summary = "Batch of daily usage rows from xiaozhi-server; answers today's LLM requests per owner")
    public Result<Map<String, Object>> report(@RequestBody UsageReportDTO dto) {
        return new Result<Map<String, Object>>().ok(usageService.report(dto == null ? null : dto.getRows()));
    }
}
