package xiaozhi.modules.contacts.controller;

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
import xiaozhi.modules.contacts.dto.ContactSendDTO;
import xiaozhi.modules.contacts.service.ContactsService;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.product.service.ProductService;

/**
 * Robot-to-robot messages for xiaozhi-server's voice tool ("বাবার রোবটকে বলো আমি আসছি"). Under
 * /config/** so the shared server secret guards it; the talking robot is named by its MAC.
 */
@Tag(name = "Robot contacts (server)")
@RestController
@RequestMapping("/config/contacts")
public class ContactsServerController {
    private final ContactsService contactsService;
    private final DeviceService deviceService;
    private final ProductService productService;

    public ContactsServerController(ContactsService contactsService, DeviceService deviceService, ProductService productService) {
        this.contactsService = contactsService;
        this.deviceService = deviceService;
        this.productService = productService;
    }

    @PostMapping("/targets")
    @Operation(summary = "Who the talking robot may message: {ok, targets: [{key, name, aliases, kind}]}")
    public Result<Map<String, Object>> targets(@RequestBody ContactSendDTO body) {
        DeviceEntity robot = robot(body);
        Map<String, Object> refusal = refusal(robot);
        if (refusal != null) {
            return new Result<Map<String, Object>>().ok(refusal);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("code", "ok");
        out.put("targets", contactsService.targets(robot.getUserId(), robot.getId()));
        return new Result<Map<String, Object>>().ok(out);
    }

    @PostMapping("/send")
    @Operation(summary = "Send a spoken message from the talking robot: {mac, target, text}")
    public Result<Map<String, Object>> send(@RequestBody ContactSendDTO body) {
        DeviceEntity robot = robot(body);
        Map<String, Object> refusal = refusal(robot);
        if (refusal != null) {
            return new Result<Map<String, Object>>().ok(refusal);
        }
        return new Result<Map<String, Object>>().ok(
                contactsService.send(robot.getUserId(), robot.getId(), body.getTarget(), body.getText()));
    }

    private DeviceEntity robot(ContactSendDTO body) {
        if (body == null || StringUtils.isBlank(body.getMac())) {
            return null;
        }
        return deviceService.getDeviceByMacAddress(body.getMac().trim());
    }

    private Map<String, Object> refusal(DeviceEntity robot) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", false);
        if (robot == null || robot.getUserId() == null) {
            out.put("code", "not_bound");
            out.put("message", "This robot is not linked to an account");
            return out;
        }
        if (!productService.hasFeature(robot.getBoard(), ContactsService.FEATURE)) {
            out.put("code", "not_supported");
            out.put("message", "This product has no robot messages");
            return out;
        }
        return null;
    }
}
