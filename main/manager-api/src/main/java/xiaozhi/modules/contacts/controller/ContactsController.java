package xiaozhi.modules.contacts.controller;

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
import xiaozhi.common.utils.Result;
import xiaozhi.modules.contacts.dto.ContactRequestDTO;
import xiaozhi.modules.contacts.dto.ContactSendDTO;
import xiaozhi.modules.contacts.service.ContactsService;
import xiaozhi.modules.security.user.SecurityUser;

/** Robot contacts of the logged-in owner, and the "message another robot" composer (Messages page). */
@Tag(name = "Robot contacts")
@RestController
@RequestMapping("/contacts")
public class ContactsController {
    private final ContactsService contactsService;

    public ContactsController(ContactsService contactsService) {
        this.contactsService = contactsService;
    }

    @GetMapping
    @Operation(summary = "My robots and my robot contacts (accepted, asked, asking)")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> overview() {
        return new Result<Map<String, Object>>().ok(contactsService.overview(SecurityUser.getUserId()));
    }

    @PostMapping
    @Operation(summary = "Ask another account: {deviceId (mine), username, name, aliases}")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> request(@RequestBody ContactRequestDTO dto) {
        return new Result<Map<String, Object>>().ok(contactsService.request(SecurityUser.getUserId(), dto));
    }

    @PostMapping("/{id}/accept")
    @Operation(summary = "Accept a request: {deviceId (mine), name, aliases}")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> accept(@PathVariable Long id, @RequestBody ContactRequestDTO dto) {
        return new Result<Map<String, Object>>().ok(contactsService.accept(SecurityUser.getUserId(), id, dto));
    }

    @PostMapping("/{id}/decline")
    @Operation(summary = "Decline a request")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> decline(@PathVariable Long id) {
        contactsService.decline(SecurityUser.getUserId(), id);
        return new Result<>();
    }

    @PutMapping("/{id}")
    @Operation(summary = "Rename my side of a contact: {name, aliases}")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> rename(@PathVariable Long id, @RequestBody ContactRequestDTO dto) {
        return new Result<Map<String, Object>>().ok(contactsService.rename(SecurityUser.getUserId(), id, dto));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Remove a contact or withdraw a request")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> remove(@PathVariable Long id) {
        contactsService.remove(SecurityUser.getUserId(), id);
        return new Result<>();
    }

    @GetMapping("/targets")
    @Operation(summary = "Who one of my robots may message: [{key, name, aliases, kind}]")
    @RequiresPermissions("sys:role:normal")
    public Result<List<Map<String, Object>>> targets(@RequestParam("deviceId") String deviceId) {
        return new Result<List<Map<String, Object>>>().ok(contactsService.targets(SecurityUser.getUserId(), deviceId));
    }

    @PostMapping("/send")
    @Operation(summary = "Send a spoken message from one of my robots to another robot")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> send(@RequestBody ContactSendDTO dto) {
        return new Result<Map<String, Object>>().ok(contactsService.send(SecurityUser.getUserId(),
                dto == null ? null : dto.getFromDeviceId(), dto == null ? null : dto.getTarget(), dto == null ? null : dto.getText()));
    }
}
