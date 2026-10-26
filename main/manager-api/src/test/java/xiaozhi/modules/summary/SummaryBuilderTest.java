package xiaozhi.modules.summary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import xiaozhi.modules.notify.service.WatchRules;
import xiaozhi.modules.summary.service.SummaryBuilder;

class SummaryBuilderTest {
    private static final LocalDate DAY = LocalDate.of(2026, 10, 26);

    private static long at(int h, int m) {
        return DAY.atTime(h, m).atZone(WatchRules.ZONE).toEpochSecond();
    }

    private static Map<String, Object> ev(String type, String id, int value, long rx) {
        return Map.of("type", type, "id", id, "value", value, "rx", rx);
    }

    @Test
    void countsOnlyTheDaysEventsAndWritesBothTexts() {
        SummaryBuilder.Input in = new SummaryBuilder.Input();
        in.day = DAY;
        in.statsAreToday = true;
        in.workMin = 25;
        in.talkCount = 12;
        in.stats = Map.of("mood", "Happy", "bond_score", 72, "bond_level", 2, "pomodoros_today", 9);
        in.memoryCreated = List.of("2026-10-26T10:00:00", "2026-10-26T18:00:00", "2026-10-25T09:00:00");
        in.events = List.of(
                ev("pomodoro_done", "", 2, at(10, 0)),
                ev("game_score", "catch", 12, at(15, 0)),
                ev("game_score", "catch", 18, at(16, 0)),
                ev("game_score", "simon", 7, at(16, 30)),
                ev("reminder_done", "r1", 0, at(9, 5)),
                ev("reminder_missed", "r2", 0, at(21, 0)),
                ev("alarm_missed", "a1", 0, at(6, 40)),
                ev("game_score", "catch", 99, at(0, 0) - 60)); // yesterday

        Map<String, Object> r = SummaryBuilder.build(in);

        assertEquals("2026-10-26", r.get("day"));
        assertEquals(12, r.get("talkCount"));
        assertEquals(2, r.get("pomodoros"), "events win over the robot's counter");
        assertEquals(50, r.get("focusMinutes"));
        assertEquals(3, r.get("gamesPlayed"));
        assertEquals(Map.of("catch", 18, "simon", 7), r.get("highScores"));
        assertEquals(1, r.get("remindersDone"));
        assertEquals(1, r.get("remindersMissed"));
        assertEquals(1, r.get("alarmsMissed"));
        assertEquals(2, r.get("newMemories"));
        assertEquals("Happy", r.get("mood"));
        assertEquals(72, r.get("bondScore"));

        String bn = SummaryBuilder.textBn(r, "টাইনিবট");
        assertTrue(bn.startsWith("টাইনিবট-এর সাথে ১২ বার কথা হয়েছে, ৫০ মিনিট"), bn);
        assertTrue(bn.contains("মেজাজ খুশি, বন্ধুত্ব ৭২"), bn);
        assertFalse(bn.contains("—"), "no em dash");
        String en = SummaryBuilder.textEn(r, "TinyBot");
        assertTrue(en.startsWith("With TinyBot: 12 talks, 50 minutes of focus, 3 games."), en);
        assertTrue(en.contains("1 alarm was not turned off."), en);
    }

    @Test
    void anEarlierDayHasNoMoodAndAQuietText() {
        SummaryBuilder.Input in = new SummaryBuilder.Input();
        in.day = DAY;
        in.statsAreToday = false;
        in.stats = Map.of("mood", "Sad", "pomodoros_today", 4);
        Map<String, Object> r = SummaryBuilder.build(in);
        assertEquals(0, r.get("focusMinutes"), "the counter is today's, not that day's");
        assertNull(r.get("mood"));
        assertNull(r.get("bondScore"));
        assertEquals("TinyBot-এর দিনটা শান্ত ছিল।", SummaryBuilder.textBn(r, "TinyBot"));
        assertEquals("A quiet day for TinyBot.", SummaryBuilder.textEn(r, "TinyBot"));
    }

    @Test
    void robotCounterFillsInWhenNoFocusEventsArrived() {
        SummaryBuilder.Input in = new SummaryBuilder.Input();
        in.day = DAY;
        in.statsAreToday = true;
        in.workMin = 30;
        in.stats = Map.of("pomodoros_today", 3);
        assertEquals(90, SummaryBuilder.build(in).get("focusMinutes"));
    }
}
