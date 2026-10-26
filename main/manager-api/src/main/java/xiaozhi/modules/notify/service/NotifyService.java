package xiaozhi.modules.notify.service;

import java.util.Collection;
import java.util.Map;

import xiaozhi.modules.device.entity.DeviceEntity;

/**
 * The notification center: per-user rows, read state, preferences, and delivery (web push now,
 * native push through {@link xiaozhi.modules.notify.push.NativePushSender} later).
 */
public interface NotifyService {

    /**
     * Creates the notification for each user whose preferences allow its group, then pushes it.
     * Returns how many users got it.
     */
    int notifyUsers(Collection<Long> userIds, NotifyMessage message);

    /** {@link #notifyUsers} for the robot's owner and its accepted family. */
    int notifyRobot(DeviceEntity device, NotifyMessage message);

    /** {total, unread, list:[...]} newest first. */
    Map<String, Object> list(Long userId, int page, int limit, boolean unreadOnly);

    long unreadCount(Long userId);

    void markRead(Long userId, Long id);

    void markAllRead(Long userId);

    /** {types:{group:bool}, offlineMinutes, summaryPush, webPush:{publicKey, subscriptions}} */
    Map<String, Object> prefsView(Long userId);

    Map<String, Object> updatePrefs(Long userId, Map<String, Object> body);

    NotifyPrefs prefs(Long userId);
}
