package xiaozhi.modules.notify.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Pure rules of the robot watch (RobotWatchTask): when a robot counts as offline, when nobody
 * has been with it for too long, and whether an alarm or reminder was answered. Times are epoch
 * seconds; days and clock times are the household's (Asia/Dhaka).
 */
public final class WatchRules {
    public static final ZoneId ZONE = ZoneId.of("Asia/Dhaka");
    /** No-activity alerts only in the day, never at night. */
    public static final LocalTime DAY_START = LocalTime.of(8, 0);
    public static final LocalTime DAY_END = LocalTime.of(21, 0);
    /** An alarm or reminder counts as unanswered this long after it rang (contract: 30 min). */
    public static final int ANSWER_WINDOW_S = 30 * 60;
    /** ... and is still worth telling about until this long after it rang. */
    public static final int REPORT_UNTIL_S = 3 * 3600;

    private WatchRules() {
    }

    /**
     * Offline for at least {@code minutes}: the companion server has not heard from the robot
     * and the MQTT gateway (when it answered) does not see it either. A robot never seen is not
     * reported.
     */
    public static boolean offlineFor(long now, long lastSeen, boolean companionOnline, Boolean gatewayOnline,
            int minutes) {
        if (companionOnline || Boolean.TRUE.equals(gatewayOnline) || lastSeen <= 0) {
            return false;
        }
        return now - lastSeen >= (long) minutes * 60;
    }

    /**
     * When something last happened with the robot: a touch (stats.last_touch_s seconds before
     * stats_updated) or a conversation, whichever is newer. Null when unknown.
     */
    public static Long lastActivity(Map<String, Object> stats, long statsUpdated, Long lastChat) {
        Long touch = null;
        Object t = stats == null ? null : stats.get("last_touch_s");
        if (t instanceof Number n && statsUpdated > 0 && n.longValue() >= 0) {
            touch = statsUpdated - n.longValue();
        }
        if (touch == null) {
            return lastChat;
        }
        return lastChat == null ? touch : Math.max(touch, lastChat);
    }

    public static boolean daytime(LocalTime t) {
        return !t.isBefore(DAY_START) && t.isBefore(DAY_END);
    }

    /** Quiet for at least {@code hours} hours (0 = the alert is off) during the day. */
    public static boolean inactive(long now, Long lastActivity, int hours, LocalTime localNow) {
        if (hours <= 0 || lastActivity == null || !daytime(localNow)) {
            return false;
        }
        return now - lastActivity >= (long) hours * 3600;
    }

    /** Weekday bitmask, bit 0 = Sunday ... bit 6 = Saturday (companion API). */
    public static boolean onDay(int days, LocalDate date) {
        int bit = date.getDayOfWeek() == DayOfWeek.SUNDAY ? 0 : date.getDayOfWeek().getValue();
        return (days & (1 << bit)) != 0;
    }

    /** Epoch seconds of "HH:MM" on that date, or null for a bad time. */
    public static Long at(String hhmm, LocalDate date) {
        if (hhmm == null || !hhmm.matches("^\\d{1,2}:\\d{2}$")) {
            return null;
        }
        String[] p = hhmm.split(":");
        int h = Integer.parseInt(p[0]);
        int m = Integer.parseInt(p[1]);
        if (h > 23 || m > 59) {
            return null;
        }
        return date.atTime(h, m).atZone(ZONE).toEpochSecond();
    }

    /** Whether an event of one of {@code types} for {@code id} arrived at or after {@code since}. */
    public static boolean answered(List<Map<String, Object>> events, Collection<String> types, String id, long since) {
        if (events == null) {
            return false;
        }
        for (Map<String, Object> e : events) {
            if (types.contains(String.valueOf(e.get("type"))) && String.valueOf(id).equals(String.valueOf(e.get("id")))
                    && eventTime(e) >= since) {
                return true;
            }
        }
        return false;
    }

    /** The server's receive time of an event (rx), else the robot's ts. */
    public static long eventTime(Map<String, Object> e) {
        Object rx = e.get("rx");
        if (rx instanceof Number n && n.longValue() > 0) {
            return n.longValue();
        }
        Object ts = e.get("ts");
        return ts instanceof Number n ? n.longValue() : 0;
    }

    /**
     * Whether a scheduled item that rang at {@code firedAt} is now overdue without an answer:
     * the answer window has passed and it is still recent enough to be worth telling.
     */
    public static boolean overdue(long now, long firedAt) {
        return now >= firedAt + ANSWER_WINDOW_S && now <= firedAt + REPORT_UNTIL_S;
    }

    public static boolean truthy(Object v, boolean dflt) {
        return v instanceof Boolean b ? b : dflt;
    }

    public static int intOf(Object v, int dflt) {
        return v instanceof Number n ? n.intValue() : dflt;
    }
}
