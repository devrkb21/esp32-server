package xiaozhi.modules.home.controller;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.home.dto.HomeActionDTO;
import xiaozhi.modules.home.dto.HomeDeviceDTO;
import xiaozhi.modules.home.dto.HomeIntegrationDTO;
import xiaozhi.modules.home.service.HomeService;
import xiaozhi.modules.security.user.SecurityUser;

/**
 * Smart home settings of the logged-in owner (page "স্মার্ট হোম" in manager-web and
 * manager-mobile). Secrets are accepted here and never returned: the view only says whether one
 * is saved.
 */
@Tag(name = "Smart home")
@RestController
@RequestMapping("/home")
public class HomeController {
    private final HomeService homeService;

    public HomeController(HomeService homeService) {
        this.homeService = homeService;
    }

    @GetMapping("/integration")
    @Operation(summary = "Home Assistant and MQTT settings (secrets only as saved / not saved)")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> integration() {
        return new Result<Map<String, Object>>().ok(homeService.getIntegration(SecurityUser.getUserId()));
    }

    @PutMapping("/integration")
    @Operation(summary = "Save Home Assistant and MQTT settings (blank secret keeps the saved one)")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> saveIntegration(@RequestBody HomeIntegrationDTO dto) {
        return new Result<Map<String, Object>>().ok(homeService.saveIntegration(SecurityUser.getUserId(), dto));
    }

    @PostMapping("/integration/test")
    @Operation(summary = "Test the saved connection: target=ha or mqtt")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> test(@RequestParam(value = "target", defaultValue = "ha") String target) {
        if (!"ha".equals(target) && !"mqtt".equals(target)) {
            throw new RenException("target must be ha or mqtt");
        }
        return new Result<Map<String, Object>>().ok(homeService.test(SecurityUser.getUserId(), target));
    }

    @PostMapping("/ha/import")
    @Operation(summary = "Import lights, switches, fans, climate and covers from Home Assistant")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> importHa() {
        return new Result<Map<String, Object>>().ok(homeService.importHa(SecurityUser.getUserId()));
    }

    @GetMapping("/devices")
    @Operation(summary = "Smart home devices with their aliases")
    @RequiresPermissions("sys:role:normal")
    public Result<List<Map<String, Object>>> devices() {
        return new Result<List<Map<String, Object>>>().ok(homeService.listDevices(SecurityUser.getUserId(), false));
    }

    @PostMapping("/devices")
    @Operation(summary = "Add a generic MQTT device")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> addDevice(@RequestBody HomeDeviceDTO dto) {
        return new Result<Map<String, Object>>().ok(homeService.saveDevice(SecurityUser.getUserId(), null, dto));
    }

    @PutMapping("/devices/{id}")
    @Operation(summary = "Edit a device: name, aliases, on for voice; topic and payloads for MQTT")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> updateDevice(@PathVariable Long id, @RequestBody HomeDeviceDTO dto) {
        return new Result<Map<String, Object>>().ok(homeService.saveDevice(SecurityUser.getUserId(), id, dto));
    }

    @DeleteMapping("/devices/{id}")
    @Operation(summary = "Remove a device from the list")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> deleteDevice(@PathVariable Long id) {
        homeService.deleteDevice(SecurityUser.getUserId(), id);
        return new Result<>();
    }

    @PostMapping("/devices/{id}/action")
    @Operation(summary = "Switch a device now (the app's test buttons)")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> action(@PathVariable Long id, @RequestBody HomeActionDTO dto) {
        return new Result<Map<String, Object>>().ok(
                homeService.act(SecurityUser.getUserId(), id, dto == null ? null : dto.getAction(), dto == null ? null : dto.getValue()));
    }
}
