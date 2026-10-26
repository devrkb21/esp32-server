package xiaozhi.modules.notify.service.impl;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.family.service.DeviceAccessService;
import xiaozhi.modules.notify.dao.NotificationDao;
import xiaozhi.modules.notify.dao.NotifyPrefDao;
import xiaozhi.modules.notify.entity.NotificationEntity;
import xiaozhi.modules.notify.entity.NotifyPrefEntity;
import xiaozhi.modules.notify.push.PushService;
import xiaozhi.modules.notify.service.NotifyMessage;
import xiaozhi.modules.notify.service.NotifyPrefs;
import xiaozhi.modules.notify.service.NotifyService;
import xiaozhi.modules.notify.service.NotifyTypes;

@Slf4j
@Service
public class NotifyServiceImpl implements NotifyService {
    /** A user keeps at most this many notifications; older ones are dropped. */
    static final int KEEP = 300;

    private final NotificationDao notificationDao;
    private final NotifyPrefDao prefDao;
    private final PushService pushService;
    private final DeviceAccessService access;

    public NotifyServiceImpl(NotificationDao notificationDao, NotifyPrefDao prefDao, PushService pushService,
            DeviceAccessService access) {
        this.notificationDao = notificationDao;
        this.prefDao = prefDao;
        this.pushService = pushService;
        this.access = access;
    }

    @Override
    public int notifyUsers(Collection<Long> userIds, NotifyMessage m) {
        if (userIds == null || m == null || StringUtils.isBlank(m.getType())) {
            return 0;
        }
        String group = NotifyTypes.groupOf(m.getType());
        int sent = 0;
        for (Long userId : new LinkedHashSet<>(userIds)) {
            NotifyPrefs prefs = userId == null ? null : prefs(userId);
            if (prefs == null || !prefs.wants(group)) {
                continue;
            }
            if (StringUtils.isNotBlank(m.getDedupeKey())) {
                Long dup = notificationDao.selectCount(new QueryWrapper<NotificationEntity>()
                        .eq("user_id", userId).eq("dedupe_key", m.getDedupeKey()));
                if (dup != null && dup > 0) {
                    continue;
                }
            }
            NotificationEntity row = new NotificationEntity();
            row.setUserId(userId);
            row.setType(m.getType());
            row.setGroupKey(group);
            row.setTitleBn(StringUtils.abbreviate(m.getTitleBn(), 200));
            row.setTitleEn(StringUtils.abbreviate(m.getTitleEn(), 200));
            row.setBodyBn(StringUtils.abbreviate(m.getBodyBn(), 1000));
            row.setBodyEn(StringUtils.abbreviate(m.getBodyEn(), 1000));
            row.setDeviceId(m.getDeviceId());
            row.setRobotName(StringUtils.abbreviate(m.getRobotName(), 64));
            row.setDedupeKey(StringUtils.abbreviate(m.getDedupeKey(), 128));
            row.setCreateDate(new Date());
            notificationDao.insert(row);
            sent++;
            trim(userId);
            if (NotifyTypes.DAILY_SUMMARY.equals(m.getType()) && !prefs.isSummaryPush()) {
                continue; // the summary stays in the list without a push at 21:00
            }
            try {
                pushService.sendToUser(userId, payload(row));
            } catch (Exception e) {
                log.debug("Push for notification {} failed: {}", row.getId(), e.getMessage());
            }
        }
        return sent;
    }

    @Override
    public int notifyRobot(DeviceEntity device, NotifyMessage message) {
        if (device == null) {
            return 0;
        }
        if (message.getDeviceId() == null) {
            message.setDeviceId(device.getId());
        }
        return notifyUsers(access.audience(device), message);
    }

    /** What the service worker gets (and native push later). */
    static Map<String, Object> payload(NotificationEntity n) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", String.valueOf(n.getId()));
        p.put("type", n.getType());
        p.put("title", StringUtils.defaultIfBlank(n.getTitleBn(), n.getTitleEn()));
        p.put("body", StringUtils.defaultIfBlank(n.getBodyBn(), n.getBodyEn()));
        p.put("titleBn", n.getTitleBn());
        p.put("titleEn", n.getTitleEn());
        p.put("bodyBn", n.getBodyBn());
        p.put("bodyEn", n.getBodyEn());
        p.put("deviceId", n.getDeviceId());
        p.put("url", NotifyTypes.DAILY_SUMMARY.equals(n.getType()) ? "/summary" : "/notifications");
        return p;
    }

    private void trim(Long userId) {
        Long count = notificationDao.selectCount(new QueryWrapper<NotificationEntity>().eq("user_id", userId));
        if (count == null || count <= KEEP) {
            return;
        }
        List<NotificationEntity> old = notificationDao.selectList(new QueryWrapper<NotificationEntity>()
                .select("id").eq("user_id", userId).orderByAsc("create_date").last("LIMIT " + (count - KEEP)));
        List<Long> ids = new ArrayList<>();
        for (NotificationEntity n : old) {
            ids.add(n.getId());
        }
        if (!ids.isEmpty()) {
            notificationDao.deleteByIds(ids);
        }
    }

    @Override
    public Map<String, Object> list(Long userId, int page, int limit, boolean unreadOnly) {
        int p = Math.max(1, page);
        int l = Math.max(1, Math.min(100, limit));
        QueryWrapper<NotificationEntity> q = new QueryWrapper<NotificationEntity>().eq("user_id", userId);
        if (unreadOnly) {
            q.isNull("read_at");
        }
        q.orderByDesc("create_date").orderByDesc("id");
        Page<NotificationEntity> result = notificationDao.selectPage(new Page<>(p, l), q);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (NotificationEntity n : result.getRecords()) {
            rows.add(view(n));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", result.getTotal());
        out.put("unread", unreadCount(userId));
        out.put("list", rows);
        return out;
    }

    static Map<String, Object> view(NotificationEntity n) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", String.valueOf(n.getId()));
        row.put("type", n.getType());
        row.put("group", n.getGroupKey());
        row.put("titleBn", n.getTitleBn());
        row.put("titleEn", n.getTitleEn());
        row.put("bodyBn", n.getBodyBn());
        row.put("bodyEn", n.getBodyEn());
        row.put("deviceId", n.getDeviceId());
        row.put("robotName", n.getRobotName());
        row.put("createdAt", n.getCreateDate() == null ? null : n.getCreateDate().getTime());
        row.put("read", n.getReadAt() != null);
        return row;
    }

    @Override
    public long unreadCount(Long userId) {
        Long n = notificationDao.selectCount(new QueryWrapper<NotificationEntity>()
                .eq("user_id", userId).isNull("read_at"));
        return n == null ? 0 : n;
    }

    @Override
    public void markRead(Long userId, Long id) {
        notificationDao.update(null, new UpdateWrapper<NotificationEntity>()
                .eq("id", id).eq("user_id", userId).isNull("read_at").set("read_at", new Date()));
    }

    @Override
    public void markAllRead(Long userId) {
        notificationDao.update(null, new UpdateWrapper<NotificationEntity>()
                .eq("user_id", userId).isNull("read_at").set("read_at", new Date()));
    }

    @Override
    public NotifyPrefs prefs(Long userId) {
        NotifyPrefEntity row = userId == null ? null : prefDao.selectById(userId);
        if (row == null || StringUtils.isBlank(row.getPrefs())) {
            return new NotifyPrefs();
        }
        try {
            return NotifyPrefs.from(JsonUtils.parseMap(row.getPrefs()));
        } catch (Exception e) {
            return new NotifyPrefs();
        }
    }

    @Override
    public Map<String, Object> prefsView(Long userId) {
        Map<String, Object> out = prefs(userId).toMap();
        Map<String, Object> web = new LinkedHashMap<>();
        try {
            web.put("publicKey", pushService.publicKey());
        } catch (Exception e) {
            web.put("publicKey", null);
        }
        web.put("subscriptions", pushService.countWeb(userId));
        out.put("webPush", web);
        return out;
    }

    @Override
    public Map<String, Object> updatePrefs(Long userId, Map<String, Object> body) {
        NotifyPrefs p = prefs(userId).apply(body);
        NotifyPrefEntity row = new NotifyPrefEntity();
        row.setUserId(userId);
        row.setPrefs(JsonUtils.toJsonString(p.toMap()));
        row.setUpdateDate(new Date());
        if (prefDao.selectById(userId) == null) {
            prefDao.insert(row);
        } else {
            prefDao.updateById(row);
        }
        return prefsView(userId);
    }
}
