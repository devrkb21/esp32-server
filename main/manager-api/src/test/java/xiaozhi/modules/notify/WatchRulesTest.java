package xiaozhi.modules.notify;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import xiaozhi.modules.notify.service.BnText;
import xiaozhi.modules.notify.service.NotifyPrefs;
import xiaozhi.modules.notify.service.NotifyTypes;
import xiaozhi.modules.notify.service.WatchRules;

class WatchRulesTest {
    private static final long NOW = 1_800_000_000L;

    @Test
    void offlineOnlyWhenNeitherServerSeesTheRobotForLongEnough() {
        assertTrue(WatchRules.offlineFor(NOW, NOW - 31 * 60, false, null, 30));
        assertTrue(WatchRules.offlineFor(NOW, NOW - 31 * 60, false, false, 30));
        assertFalse(WatchRules.offlineFor(NOW, NOW - 29 * 60, false, null, 30));
        assertFalse(WatchRules.offlineFor(NOW, NOW - 31 * 60, true, null, 30));
        assertFalse(WatchRules.offlineFor(NOW, NOW - 31 * 60, false, true, 30), "the gateway still sees it");
        assertFalse(WatchRules.offlineFor(NOW, 0, false, null, 30), "never seen: nothing to report");
    }

    @Test
    void lastActivityIsTheNewerOfTouchAndTalk() {
        Map<String, Object> stats = Map.of("last_touch_s", 600);
        assertEquals(NOW - 600, WatchRules.lastActivity(stats, NOW, null));
        assertEquals(NOW - 60, WatchRules.lastActivity(stats, NOW, NOW - 60));
        assertEquals(NOW - 600, WatchRules.lastActivity(stats, NOW, NOW - 9000));
        assertEquals(NOW - 5, WatchRules.lastActivity(Map.of(), NOW, NOW - 5));
        assertNull(WatchRules.lastActivity(null, 0, null));
    }

    @Test
    void noActivityOnlyInTheDayAndWhenSwitchedOn() {
        long last = NOW - 4 * 3600 - 1;
        assertTrue(WatchRules.inactive(NOW, last, 4, LocalTime.of(14, 0)));
        assertFalse(WatchRules.inactive(NOW, last, 4, LocalTime.of(22, 0)), "never at night");
        assertFalse(WatchRules.inactive(NOW, last, 4, LocalTime.of(7, 59)));
        assertFalse(WatchRules.inactive(NOW, last, 0, LocalTime.of(14, 0)), "0 = off");
        assertFalse(WatchRules.inactive(NOW, NOW - 3600, 4, LocalTime.of(14, 0)));
        assertFalse(WatchRules.inactive(NOW, null, 4, LocalTime.of(14, 0)));
    }

    @Test
    void weekdayMaskAndClockTimes() {
        LocalDate sunday = LocalDate.of(2026, 10, 25);
        LocalDate monday = sunday.plusDays(1);
        assertTrue(WatchRules.onDay(1, sunday));
        assertFalse(WatchRules.onDay(1, monday));
        assertTrue(WatchRules.onDay(62, monday));
        assertTrue(WatchRules.onDay(127, sunday.plusDays(6)));
        long at = WatchRules.at("06:30", sunday);
        assertEquals(LocalDate.of(2026, 10, 25).atTime(6, 30).atZone(WatchRules.ZONE).toEpochSecond(), at);
        assertNull(WatchRules.at("25:00", sunday));
        assertNull(WatchRules.at("soon", sunday));
    }

    @Test
    void anAnswerCountsOnlyAfterTheItemRang() {
        List<Map<String, Object>> events = List.of(
                Map.of("type", "reminder_done", "id", "r1", "rx", NOW - 100),
                Map.of("type", "reminder_done", "id", "r2", "rx", NOW - 9000));
        assertTrue(WatchRules.answered(events, List.of("reminder_done"), "r1", NOW - 1800));
        assertFalse(WatchRules.answered(events, List.of("reminder_done"), "r2", NOW - 1800), "answered yesterday's");
        assertFalse(WatchRules.answered(events, List.of("alarm_dismissed"), "r1", 0));
        assertTrue(WatchRules.overdue(NOW, NOW - 31 * 60));
        assertFalse(WatchRules.overdue(NOW, NOW - 29 * 60));
        assertFalse(WatchRules.overdue(NOW, NOW - 4 * 3600), "too old to tell");
        assertEquals(7, WatchRules.eventTime(Map.of("ts", 7)));
    }

    @Test
    void preferencesDefaultOnAndClampTheOfflineMinutes() {
        NotifyPrefs p = new NotifyPrefs();
        for (String g : NotifyTypes.GROUPS) {
            assertTrue(p.wants(g));
        }
        assertTrue(p.wants(null), "test notifications always arrive");
        p.apply(Map.of("types", Map.of("care", false, "bogus", false), "offlineMinutes", 5, "summaryPush", false));
        assertFalse(p.wants("care"));
        assertEquals(NotifyPrefs.OFFLINE_MIN, p.getOfflineMinutes());
        assertFalse(p.isSummaryPush());
        assertFalse(p.getTypes().containsKey("bogus"));
        assertEquals(NotifyPrefs.OFFLINE_MAX, NotifyPrefs.from(Map.of("offlineMinutes", 99999)).getOfflineMinutes());
        assertEquals(NotifyTypes.G_CARE, NotifyTypes.groupOf(NotifyTypes.CARE_FALL));
        assertNull(NotifyTypes.groupOf(NotifyTypes.TEST));
    }

    @Test
    void banglaDigitsAndTimes() {
        assertEquals("৩০ মিনিট", BnText.digits("30 মিনিট"));
        assertEquals("৯:০৫", BnText.time("21:05"));
        assertEquals("১২:০০", BnText.time("00:00"));
        assertEquals("9:05 pm", BnText.timeEn("21:05"));
        assertEquals("12:30 am", BnText.timeEn("00:30"));
    }
}
