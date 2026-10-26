package xiaozhi.modules.kids.controller;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.user.UserDetail;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.agent.service.AgentService;
import xiaozhi.modules.kids.dto.AgentKidsDTO;
import xiaozhi.modules.kids.service.AgentKidsService;
import xiaozhi.modules.security.user.SecurityUser;

/**
 * Kids mode of a character (the character page's "Kids mode" section). The robot picks it up at
 * its next chat, with the rest of the agent config.
 */
@RestController
@RequestMapping("/agent/{agentId}/kids")
@Tag(name = "Kids mode")
@AllArgsConstructor
public class AgentKidsController {
    private final AgentKidsService agentKidsService;
    private final AgentService agentService;

    private void checkPermission(String agentId) {
        UserDetail user = SecurityUser.getUser();
        if (user == null || !agentService.checkAgentPermission(agentId, user.getId())) {
            throw new RenException(ErrorCode.NO_PERMISSION);
        }
    }

    @GetMapping
    @Operation(summary = "Kids mode of a character: {enabled, age, blockedTopics}")
    @RequiresPermissions("sys:role:normal")
    public Result<AgentKidsDTO> get(@PathVariable String agentId) {
        checkPermission(agentId);
        return new Result<AgentKidsDTO>().ok(agentKidsService.get(agentId));
    }

    @PutMapping
    @Operation(summary = "Save kids mode of a character (age 3-12, at most 30 topics)")
    @RequiresPermissions("sys:role:normal")
    public Result<AgentKidsDTO> save(@PathVariable String agentId, @RequestBody AgentKidsDTO dto) {
        checkPermission(agentId);
        return new Result<AgentKidsDTO>().ok(agentKidsService.save(agentId, dto));
    }
}
