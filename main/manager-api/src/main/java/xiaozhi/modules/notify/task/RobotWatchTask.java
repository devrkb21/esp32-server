package xiaozhi.modules.notify.task;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.redis.RedisUtils;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.agent.dao.AiAgentChatHistoryDao;
import xiaozhi.modules.agent.entity.AgentChatHistoryEntity;
import xiaozhi.modules.device.dao.DeviceDao;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.service.DeviceService;
import xiaozhi.modules.family.service.DeviceAccessService;
import xiaozhi.modules.notify.service.BnText;
import xiaozhi.modules.notify.service.CompanionClient;
import xiaozhi.modules.notify.service.NotifyMessage;
import xiaozhi.modules.notify.service.NotifyService;
import xiaozhi.modules.notify.service.NotifyTypes;
import xiaozhi.modules.notify.service.WatchRules;

/**
 * Watches every robot every two minutes and notifies its owner and family:
 * <ul>
 * <li>robot offline for longer than each person's {@code offlineMinutes} (companion server and
 * MQTT gateway both do not see it), once per offline spell;</li>
 * <li>an alarm not turned off ({@code alarm_missed}, or no dismiss/snooze within 30 minutes);</li>
 * <li>a reminder not confirmed ({@code reminder_missed}, or no {@code reminder_done} within 30
 * minutes of a timed reminder);</li>
 * <li>care alerts (companion setting {@code care}): a {@code fall} event, a missed medicine
 * reminder, no touch or talk for {@code no_activity_hours} during the day.</li>
 * </ul>
 * Robot events are read from the companion API; what was already handled is kept in Redis and in
 * the notifications' dedupe keys, so nothing is said twice.
 */
@Slf4j
@Component
public class RobotWatchTask {
    private static final String RX_KEY = "family:watch:rx:";
    private static final String NOACT_KEY = "family:watch:noact:";
    private static final long DAY_S = 24 * 3600L;

    private final CompanionClient companion;
    private final DeviceDao deviceDao;
    private final DeviceService deviceService;
    private final DeviceAccessService access;
    private final NotifyService notifyService;
    private final RedisUtils redisUtils;
    private final AiAgentChatHistoryDao chatHistoryDao;

    public RobotWatchTask(CompanionClient companion, DeviceDao deviceDao, DeviceService deviceService,
            DeviceAccessService access, NotifyService notifyService, RedisUtils redisUtils,
            AiAgentChatHistoryDao chatHistoryDao) {
        this.companion = companion;
        this.deviceDao = deviceDao;
        this.deviceService = deviceService;
        this.access = access;
        this.notifyService = notifyService;
        this.redisUtils = redisUtils;
        this.chatHistoryDao = chatHistoryDao;
    }

    @Scheduled(initialDelay = 90_000, fixedDelay = 120_000)
    public void run() {
        try {
            tick(System.currentTimeMillis() / 1000);
        } catch (Exception e) {
            log.warn("Robot watch failed: {}", e.getMessage());
        }
    }

    void tick(long now) {
        if (companion.baseUrl() == null) {
            return;
        }
        List<Map<String, Object>> robots = companion.devices();
        if (robots.isEmpty()) {
            return;
        }
        Map<String, Map<String, Object>> byMac = new HashMap<>();
        Set<String> macs = new HashSet<>();
        for (Map<String, Object> r : robots) {
            String mac = String.valueOf(r.get("id")).toLowerCase();
            byMac.put(mac, r);
            macs.add(mac);
            macs.add(mac.toUpperCase());
        }
        List<DeviceEntity> devices = deviceDao.selectList(new QueryWrapper<DeviceEntity>().in("mac_address", macs));
        if (devices.isEmpty()) {
            return;
        }
        Map<String, Boolean> gateway = deviceService.gatewayOnline(devices);
        for (DeviceEntity device : devices) {
            Map<String, Object> summary = byMac.get(String.valueOf(device.getMacAddress()).toLowerCase());
            if (summary == null || device.getUserId() == null) {
                continue;
            }
            try {
                watch(device, summary, gateway.get(device.getId()), now);
            } catch (Exception e) {
                log.debug("Robot watch of {} failed: {}", device.getId(), e.getMessage());
            }
        }
    }

    private void watch(DeviceEntity device, Map<String, Object> summary, Boolean gatewayOnline, long now) {
        List<Long> audience = access.audience(device);
        if (audience.isEmpty()) {
            return;
        }
        long lastSeen = WatchRules.intOf(summary.get("last_seen"), 0);
        boolean online = WatchRules.truthy(summary.get("online"), false);
        String name = robotName(device, summary);

        // 1. offline, per person (each chooses after how many minutes)
        for (Long userId : audience) {
            int minutes = notifyService.prefs(userId).getOfflineMinutes();
            if (WatchRules.offlineFor(now, lastSeen, online, gatewayOnline, minutes)) {
                notifyService.notifyUsers(List.of(userId), NotifyMessage.of(NotifyTypes.ROBOT_OFFLINE)
                        .title("রোবট অফলাইন", "Robot offline")
                        .body(name + " " + BnText.digits(minutes) + " মিনিটের বেশি সময় ধরে অফলাইন। Wi-Fi আর চার্জ দেখুন।",
                                name + " has been offline for more than " + minutes + " minutes. Check its Wi-Fi and power.")
                        .setDeviceId(device.getId()).setRobotName(name)
                        .setDedupeKey("offline:" + device.getId() + ":" + lastSeen));
            }
        }
        if (!online && !Boolean.TRUE.equals(gatewayOnline) && now - lastSeen > DAY_S) {
            return; // long gone: nothing new to read
        }

        // 2. the full view (care settings, alarms, reminders, stats) and the recent events
        String mac = device.getMacAddress();
        Map<String, Object> view = companion.device(mac);
        if (view == null) {
            return;
        }
        List<Map<String, Object>> events = companion.events(mac, 200);
        Map<String, Object> care = mapOf(mapOf(view.get("settings")).get("care"));
        boolean careOn = WatchRules.truthy(care.get("enabled"), true);
        Map<String, Map<String, Object>> reminders = byId(view.get("reminders"));
        Map<String, Map<String, Object>> alarms = byId(view.get("alarms"));
        ZonedDateTime local = ZonedDateTime.ofInstant(java.time.Instant.ofEpochSecond(now), WatchRules.ZONE);
        LocalDate today = local.toLocalDate();

        // 3. new events since the last run
        String rxKey = RX_KEY + device.getId();
        Object seen = redisUtils.get(rxKey);
        long lastRx = seen instanceof Number n ? n.longValue() : -1;
        long newest = lastRx;
        List<Map<String, Object>> fresh = new ArrayList<>();
        for (Map<String, Object> e : events) {
            long t = WatchRules.eventTime(e);
            newest = Math.max(newest, t);
            if (lastRx >= 0 && t > lastRx) {
                fresh.add(e);
            }
        }
        // First sight of a robot: only remember where we are, never replay old events
        redisUtils.set(rxKey, newest < 0 ? now : newest, 30 * DAY_S);
        fresh.sort(Comparator.comparingLong(WatchRules::eventTime));
        for (Map<String, Object> e : fresh) {
            onEvent(device, name, e, careOn, care, reminders, alarms);
        }

        // 4. timed alarms and reminders nobody answered within 30 minutes (robot was online)
        if (online || Boolean.TRUE.equals(gatewayOnline)) {
            for (Map<String, Object> a : alarms.values()) {
                Long fired = firedToday(a, today);
                if (fired != null && WatchRules.overdue(now, fired) && lastSeen >= fired
                        && !WatchRules.answered(events, List.of("alarm_dismissed", "alarm_snoozed"), str(a.get("id")), fired)) {
                    alarmMissed(device, name, a, today);
                }
            }
            for (Map<String, Object> r : reminders.values()) {
                if (!"time".equals(r.get("mode"))) {
                    continue; // interval reminders (water) only count through reminder_missed events
                }
                Long fired = firedToday(r, today);
                if (fired != null && WatchRules.overdue(now, fired) && lastSeen >= fired
                        && !WatchRules.answered(events, List.of("reminder_done"), str(r.get("id")), fired)) {
                    reminderMissed(device, name, r, today, careOn, care);
                }
            }
        }

        // 5. no activity for N hours during the day
        int hours = WatchRules.intOf(care.get("no_activity_hours"), 0);
        String noactKey = NOACT_KEY + device.getId();
        if (careOn && hours > 0 && online) {
            Map<String, Object> stats = mapOf(view.get("stats"));
            long statsUpdated = WatchRules.intOf(view.get("stats_updated"), 0);
            Long last = WatchRules.lastActivity(stats, statsUpdated, lastChat(mac));
            if (WatchRules.inactive(now, last, hours, local.toLocalTime())) {
                if (redisUtils.get(noactKey) == null) {
                    redisUtils.set(noactKey, 1, DAY_S);
                    notifyService.notifyRobot(device, NotifyMessage.of(NotifyTypes.CARE_NO_ACTIVITY)
                            .title("যত্নের সতর্কতা: অনেকক্ষণ সাড়া নেই", "Care alert: quiet for a while")
                            .body(name + " " + BnText.digits(hours) + " ঘণ্টার বেশি কারও ছোঁয়া বা কথা পায়নি। একবার খোঁজ নিন।",
                                    name + " has had no touch or talk for more than " + hours + " hours. You may want to check in.")
                            .setRobotName(name).setDedupeKey("noact:" + device.getId() + ":" + (last == null ? 0 : last)));
                }
            } else if (last != null && now - last < (long) hours * 3600) {
                redisUtils.delete(noactKey);
            }
        }
    }

    private void onEvent(DeviceEntity device, String name, Map<String, Object> e, boolean careOn, Map<String, Object> care,
            Map<String, Map<String, Object>> reminders, Map<String, Map<String, Object>> alarms) {
        String type = str(e.get("type"));
        long t = WatchRules.eventTime(e);
        LocalDate day = ZonedDateTime.ofInstant(java.time.Instant.ofEpochSecond(t), WatchRules.ZONE).toLocalDate();
        switch (type) {
            case "fall" -> {
                if (careOn && WatchRules.truthy(care.get("fall_alert"), true)) {
                    notifyService.notifyRobot(device, NotifyMessage.of(NotifyTypes.CARE_FALL)
                            .title("যত্নের সতর্কতা: জোরে ধাক্কা", "Care alert: a hard knock")
                            .body(name + " হঠাৎ পড়ে গেছে বা জোরে ধাক্কা খেয়েছে। কাছে কেউ থাকলে একবার খোঁজ নিন।",
                                    name + " was dropped or knocked hard. If someone is nearby, you may want to check in.")
                            .setRobotName(name).setDedupeKey("fall:" + device.getId() + ":" + t));
                }
            }
            case "alarm_missed" -> {
                Map<String, Object> a = alarms.get(str(e.get("id")));
                alarmMissed(device, name, a == null ? Map.of("id", str(e.get("id"))) : a, day);
            }
            case "reminder_missed" -> {
                Map<String, Object> r = reminders.get(str(e.get("id")));
                reminderMissed(device, name, r == null ? Map.of("id", str(e.get("id"))) : r, day, careOn, care);
            }
            default -> {
                // other events feed the daily summary only
            }
        }
    }

    private void alarmMissed(DeviceEntity device, String name, Map<String, Object> a, LocalDate day) {
        String time = str(a.get("time"));
        String label = StringUtils.defaultIfBlank(str(a.get("label")), "");
        String what = label.isEmpty() ? "" : " (" + label + ")";
        notifyService.notifyRobot(device, NotifyMessage.of(NotifyTypes.ALARM_MISSED)
                .title("অ্যালার্ম কেউ বন্ধ করেনি", "Alarm not turned off")
                .body(name + ": " + (time.isEmpty() ? "" : BnText.time(time) + " এর ") + "অ্যালার্ম" + what + " বেজেছে, কেউ বন্ধ করেনি।",
                        name + ": the " + (time.isEmpty() ? "" : BnText.timeEn(time) + " ") + "alarm" + what + " rang and nobody turned it off.")
                .setRobotName(name).setDedupeKey("alarm:" + device.getId() + ":" + str(a.get("id")) + ":" + day));
    }

    private void reminderMissed(DeviceEntity device, String name, Map<String, Object> r, LocalDate day, boolean careOn,
            Map<String, Object> care) {
        String time = str(r.get("time"));
        String key = "rem:" + device.getId() + ":" + str(r.get("id")) + ":" + day + ":" + time;
        boolean medicine = "medicine".equals(r.get("kind"));
        String at = time.isEmpty() ? "" : " (" + BnText.time(time) + ")";
        String atEn = time.isEmpty() ? "" : " (" + BnText.timeEn(time) + ")";
        if (medicine && careOn && WatchRules.truthy(care.get("missed_medicine_alert"), true)) {
            notifyService.notifyRobot(device, NotifyMessage.of(NotifyTypes.CARE_MEDICINE)
                    .title("যত্নের সতর্কতা: ওষুধের রিমাইন্ডার", "Care alert: medicine reminder")
                    .body(name + ": ওষুধের রিমাইন্ডারে" + at + " ৩০ মিনিটে কেউ সাড়া দেয়নি। একবার খোঁজ নিন।",
                            name + ": nobody confirmed the medicine reminder" + atEn + " within 30 minutes. You may want to check in.")
                    .setRobotName(name).setDedupeKey(key));
            return;
        }
        String label = StringUtils.defaultIfBlank(str(r.get("label")), "");
        String what = label.isEmpty() ? "" : " (" + label + ")";
        notifyService.notifyRobot(device, NotifyMessage.of(NotifyTypes.REMINDER_MISSED)
                .title("রিমাইন্ডার নিশ্চিত হয়নি", "Reminder not confirmed")
                .body(name + ": রিমাইন্ডার" + what + at + " বেজেছে, ৩০ মিনিটে কেউ নিশ্চিত করেনি।",
                        name + ": nobody confirmed the reminder" + what + atEn + " within 30 minutes.")
                .setRobotName(name).setDedupeKey(key));
    }

    /** When an enabled timed item rang today, or null. */
    private static Long firedToday(Map<String, Object> item, LocalDate today) {
        if (!WatchRules.truthy(item.get("enabled"), true)) {
            return null;
        }
        int days = WatchRules.intOf(item.get("days"), 127);
        if (days == 0 || !WatchRules.onDay(days, today)) {
            return null;
        }
        return WatchRules.at(str(item.get("time")), today);
    }

    private Long lastChat(String mac) {
        try {
            AgentChatHistoryEntity row = chatHistoryDao.selectOne(new QueryWrapper<AgentChatHistoryEntity>()
                    .select("created_at").eq("mac_address", mac).eq("chat_type", 1)
                    .orderByDesc("created_at").last("LIMIT 1"));
            return row == null || row.getCreatedAt() == null ? null : row.getCreatedAt().getTime() / 1000;
        } catch (Exception e) {
            return null;
        }
    }

    static String robotName(DeviceEntity device, Map<String, Object> summary) {
        if (StringUtils.isNotBlank(device.getAlias())) {
            return device.getAlias();
        }
        String n = summary == null ? null : str(summary.get("name"));
        return StringUtils.isNotBlank(n) ? n : "TinyBot";
    }

    private static Map<String, Map<String, Object>> byId(Object list) {
        Map<String, Map<String, Object>> out = new HashMap<>();
        if (list instanceof List<?>) {
            for (Map<String, Object> m : JsonUtils.toStringObjectMapList(list)) {
                out.put(str(m.get("id")), m);
            }
        }
        return out;
    }

    private static Map<String, Object> mapOf(Object o) {
        return o instanceof Map<?, ?> ? JsonUtils.toStringObjectMap(o) : new HashMap<>();
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
