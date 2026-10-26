package xiaozhi.modules.notify.controller;

import java.util.List;
import java.util.Map;

import org.apache.shiro.authz.annotation.RequiresPermissions;
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
import xiaozhi.modules.notify.push.PushService;
import xiaozhi.modules.notify.service.NotifyMessage;
import xiaozhi.modules.notify.service.NotifyService;
import xiaozhi.modules.notify.service.NotifyTypes;
import xiaozhi.modules.security.user.SecurityUser;

/**
 * The notification center and push registration (docs/family-and-notifications.md).
 */
@Tag(name = "Notifications")
@RestController
@RequestMapping("/notify")
public class NotifyController {
    private final NotifyService notifyService;
    private final PushService pushService;

    public NotifyController(NotifyService notifyService, PushService pushService) {
        this.notifyService = notifyService;
        this.pushService = pushService;
    }

    @GetMapping("/list")
    @Operation(summary = "My notifications, newest first")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> list(@RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "limit", defaultValue = "20") int limit,
            @RequestParam(value = "unread", defaultValue = "0") int unread) {
        return new Result<Map<String, Object>>()
                .ok(notifyService.list(SecurityUser.getUserId(), page, limit, unread == 1));
    }

    @GetMapping("/unread-count")
    @Operation(summary = "How many are unread")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> unread() {
        return new Result<Map<String, Object>>().ok(Map.of("unread", notifyService.unreadCount(SecurityUser.getUserId())));
    }

    @PostMapping("/{id}/read")
    @Operation(summary = "Mark one read")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> read(@PathVariable Long id) {
        notifyService.markRead(SecurityUser.getUserId(), id);
        return new Result<>();
    }

    @PostMapping("/read-all")
    @Operation(summary = "Mark all read")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> readAll() {
        notifyService.markAllRead(SecurityUser.getUserId());
        return new Result<>();
    }

    @GetMapping("/prefs")
    @Operation(summary = "Which notifications I get")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> prefs() {
        return new Result<Map<String, Object>>().ok(notifyService.prefsView(SecurityUser.getUserId()));
    }

    @PutMapping("/prefs")
    @Operation(summary = "Change which notifications I get")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> updatePrefs(@RequestBody Map<String, Object> body) {
        return new Result<Map<String, Object>>().ok(notifyService.updatePrefs(SecurityUser.getUserId(), body));
    }

    @GetMapping("/push/vapid")
    @Operation(summary = "The VAPID public key for browser push")
    @RequiresPermissions("sys:role:normal")
    public Result<Map<String, Object>> vapid() {
        return new Result<Map<String, Object>>().ok(Map.of("publicKey", pushService.publicKey()));
    }

    @PostMapping("/push/subscribe")
    @Operation(summary = "Register a browser push subscription")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> subscribe(@RequestBody Map<String, Object> body) {
        Object keys = body == null ? null : body.get("keys");
        Map<?, ?> k = keys instanceof Map<?, ?> m ? m : Map.of();
        pushService.subscribe(SecurityUser.getUserId(), str(body, "endpoint"), str(k, "p256dh"), str(k, "auth"),
                str(body, "platform"));
        return new Result<>();
    }

    @PostMapping("/push/unsubscribe")
    @Operation(summary = "Forget a browser push subscription")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> unsubscribe(@RequestBody Map<String, Object> body) {
        pushService.unsubscribe(SecurityUser.getUserId(), str(body, "endpoint"));
        return new Result<>();
    }

    @PostMapping("/push/native")
    @Operation(summary = "Register a native push token (uni-push / FCM; not sent yet, see NativePushSender)")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> registerNative(@RequestBody Map<String, Object> body) {
        pushService.registerNative(SecurityUser.getUserId(), str(body, "provider"), str(body, "token"));
        return new Result<>();
    }

    @PostMapping("/push/test")
    @Operation(summary = "Send myself a test notification")
    @RequiresPermissions("sys:role:normal")
    public Result<Void> test() {
        notifyService.notifyUsers(List.of(SecurityUser.getUserId()), NotifyMessage.of(NotifyTypes.TEST)
                .title("পরীক্ষার নোটিফিকেশন", "Test notification")
                .body("নোটিফিকেশন ঠিকমতো আসছে।", "Notifications are working."));
        return new Result<>();
    }

    private static String str(Map<?, ?> m, String key) {
        Object v = m == null ? null : m.get(key);
        return v == null ? null : String.valueOf(v);
    }
}
