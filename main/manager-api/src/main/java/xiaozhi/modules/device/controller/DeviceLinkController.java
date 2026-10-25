package xiaozhi.modules.device.controller;

import org.apache.shiro.authz.annotation.RequiresPermissions;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AllArgsConstructor;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.device.dto.DeviceLinkDTO;
import xiaozhi.modules.device.service.DeviceLinkService;
import xiaozhi.modules.device.vo.DeviceLinkInfoVO;
import xiaozhi.modules.device.vo.DeviceLinkResultVO;
import xiaozhi.modules.security.user.SecurityUser;

/**
 * Link a robot to the signed-in account with the code (or QR) the robot shows.
 */
@Tag(name = "Device link")
@RestController
@RequestMapping("/device/link")
@AllArgsConstructor
public class DeviceLinkController {

    private final DeviceLinkService deviceLinkService;

    @GetMapping("/{code}")
    @Operation(summary = "Look up a robot waiting to be linked")
    @RequiresPermissions("sys:role:normal")
    public Result<DeviceLinkInfoVO> lookup(@PathVariable String code) {
        return new Result<DeviceLinkInfoVO>().ok(deviceLinkService.lookup(code));
    }

    @PostMapping
    @Operation(summary = "Link a robot to the signed-in account")
    @RequiresPermissions("sys:role:normal")
    public Result<DeviceLinkResultVO> link(@RequestBody DeviceLinkDTO dto) {
        return new Result<DeviceLinkResultVO>().ok(deviceLinkService.link(SecurityUser.getUserId(), dto));
    }
}
