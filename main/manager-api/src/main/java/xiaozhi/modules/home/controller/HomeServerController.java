package xiaozhi.modules.home.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import xiaozhi.common.utils.Result;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.home.dto.HomeActionDTO;
import xiaozhi.modules.home.service.HomeService;
import xiaozhi.modules.product.service.ProductService;

/**
 * Smart home for xiaozhi-server's voice tool. Under /config/** so the shared server secret
 * guards it (ShiroConfig); the robot is named by its MAC and acts for its owner. The answer never
 * carries a secret: the server matches the spoken name against the list, then asks for the action.
 * Failures come back as {ok: false, code} (not_bound, not_supported, not_found, unreachable, ...).
 */
@Tag(name = "Smart home (server)")
@RestController
@RequestMapping("/config/home")
public class HomeServerController {
    private final HomeService homeService;
    private final DeviceService deviceService;
    private final ProductService productService;

    public HomeServerController(HomeService homeService, DeviceService deviceService, ProductService productService) {
        this.homeService = homeService;
        this.deviceService = deviceService;
        this.productService = productService;
    }

    @PostMapping("/devices")
    @Operation(summary = "The devices the robot's owner switched on for voice")
    public Result<Map<String, Object>> devices(@RequestBody HomeActionDTO body) {
        DeviceEntity robot = robot(body);
        Map<String, Object> refusal = refusal(robot);
        if (refusal != null) {
            return new Result<Map<String, Object>>().ok(refusal);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("code", "ok");
        out.put("devices", homeService.listDevices(robot.getUserId(), true));
        Map<String, Object> integration = homeService.getIntegration(robot.getUserId());
        out.put("integration", integration);
        return new Result<Map<String, Object>>().ok(out);
    }

    @PostMapping("/action")
    @Operation(summary = "Switch one of the owner's devices")
    public Result<Map<String, Object>> action(@RequestBody HomeActionDTO body) {
        DeviceEntity robot = robot(body);
        Map<String, Object> refusal = refusal(robot);
        if (refusal != null) {
            return new Result<Map<String, Object>>().ok(refusal);
        }
        Long id;
        try {
            id = Long.valueOf(StringUtils.trimToEmpty(body.getDeviceId()));
        } catch (NumberFormatException e) {
            id = null;
        }
        return new Result<Map<String, Object>>().ok(homeService.act(robot.getUserId(), id, body.getAction(), body.getValue()));
    }

    private DeviceEntity robot(HomeActionDTO body) {
        if (body == null || StringUtils.isBlank(body.getMac())) {
            return null;
        }
        return deviceService.getDeviceByMacAddress(body.getMac().trim());
    }

    private Map<String, Object> refusal(DeviceEntity robot) {
        if (robot == null || robot.getUserId() == null) {
            return fail("not_bound", "This robot is not linked to an account");
        }
        if (!productService.hasFeature(robot.getBoard(), HomeService.FEATURE)) {
            return fail("not_supported", "This product has no smart home");
        }
        return null;
    }

    private static Map<String, Object> fail(String code, String message) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", false);
        out.put("code", code);
        out.put("message", message);
        return out;
    }
}
