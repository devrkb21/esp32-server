package xiaozhi.modules.family.controller;

import java.util.List;
import java.util.Map;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.family.service.FamilyService;
import xiaozhi.modules.security.user.SecurityUser;

/**
 * Family sharing of robots (docs/family-and-notifications.md).
 */
@Tag(name = "Family sharing")
@RestController
@RequestMapping("/family")
public class FamilyController {
    private final FamilyService familyService;

    public FamilyController(FamilyService familyService) {
        this.familyService = familyService;
    }

    @GetMapping("/robots")
    @Operation(summary = "Robots shared with me")
    @RequiresPermissions("sys:role:normal")
    public Result<List<Map<String, Object>>> robots() {
        return new Result<List<Map<String, Object>>>().ok(familyService.sharedRobots(SecurityUser.getUserId()));
    }

    @GetMapping("/device/{deviceId}")
    @Operation(summary = "The family of one robot")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> device(@PathVariable String deviceId) {
        return new Result<Map<String, Object>>().ok(familyService.deviceFamily(deviceId, SecurityUser.getUserId()));
    }

    @PostMapping("/device/{deviceId}/invite")
    @Operation(summary = "Invite an account (username or phone) as member or co_owner")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> invite(@PathVariable String deviceId, @RequestBody Map<String, Object> body) {
        String target = body == null || body.get("target") == null ? "" : String.valueOf(body.get("target"));
        String role = body == null || body.get("role") == null ? "member" : String.valueOf(body.get("role"));
        return new Result<Map<String, Object>>()
                .ok(familyService.invite(deviceId, SecurityUser.getUserId(), target, role));
    }

    @PutMapping("/share/{id}")
    @Operation(summary = "Change a member's role (owner)")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> changeRole(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        String role = body == null || body.get("role") == null ? "" : String.valueOf(body.get("role"));
        familyService.changeRole(id, SecurityUser.getUserId(), role);
        return new Result<>();
    }

    @DeleteMapping("/share/{id}")
    @Operation(summary = "Remove someone, cancel an invite, or leave")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> remove(@PathVariable Long id) {
        familyService.remove(id, SecurityUser.getUserId());
        return new Result<>();
    }

    @GetMapping("/invites")
    @Operation(summary = "Pending invitations to me")
    @RequiresPermissions("sys:role:normal")
    public Result<List<Map<String, Object>>> invites() {
        return new Result<List<Map<String, Object>>>().ok(familyService.invites(SecurityUser.getUserId()));
    }

    @PostMapping("/invites/{id}/accept")
    @Operation(summary = "Accept an invitation")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> accept(@PathVariable Long id) {
        familyService.respond(id, SecurityUser.getUserId(), true);
        return new Result<>();
    }

    @PostMapping("/invites/{id}/decline")
    @Operation(summary = "Decline an invitation")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> decline(@PathVariable Long id) {
        familyService.respond(id, SecurityUser.getUserId(), false);
        return new Result<>();
    }
}
