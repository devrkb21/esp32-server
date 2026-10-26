package xiaozhi.modules.summary.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import xiaozhi.modules.notify.service.BnText;
import xiaozhi.modules.notify.service.WatchRules;

/**
 * Builds one robot's day from what the server knows (pure, unit tested): the robot's events of
 * that day, its latest stats, how often someone talked to it, and its new memories. Writes a
 * short Bangla and English text from the numbers. Nothing is guessed: a number the server does
 * not have stays out of the text.
 */
public final class SummaryBuilder {

    /** Bangla words for the moods the robot reports. */
    static final Map<String, String> MOOD_BN = Map.of(
            "Happy", "খুশি", "Excited", "উচ্ছ্বসিত", "Curious", "কৌতূহলী", "Shy", "লাজুক", "Sad", "মন খারাপ",
            "Annoyed", "বিরক্ত", "Sleepy", "ঘুমঘুম", "Affectionate", "আদুরে", "Neutral", "শান্ত");

    private SummaryBuilder() {
    }

    /** What went into the day. */
    public static class Input {
        public LocalDate day;
        public String robotName = "TinyBot";
        /** All recent events (any day); only the day's are counted */
        public List<Map<String, Object>> events = new ArrayList<>();
        /** The robot's stats now; used for mood, bond and today's pomodoros when building today */
        public Map<String, Object> stats;
        /** Whether the stats describe this day (the build runs on the day itself) */
        public boolean statsAreToday;
        public int workMin = 25;
        public int talkCount;
        /** memories[].created, "YYYY-MM-DDTHH:MM:SS" */
        public List<String> memoryCreated = new ArrayList<>();
    }

    /** The numbers of a day, in the shape the apps read (GET /summary/device/{id}). */
    public static Map<String, Object> build(Input in) {
        int pomodoros = 0;
        int games = 0;
        Map<String, Integer> high = new LinkedHashMap<>();
        int remDone = 0;
        int remMissed = 0;
        int alarmMissed = 0;
        for (Map<String, Object> e : in.events) {
            long t = WatchRules.eventTime(e);
            if (t <= 0 || !Instant.ofEpochSecond(t).atZone(WatchRules.ZONE).toLocalDate().equals(in.day)) {
                continue;
            }
            String type = String.valueOf(e.get("type"));
            int value = WatchRules.intOf(e.get("value"), 0);
            switch (type) {
                case "pomodoro_done" -> pomodoros += Math.max(1, value);
                case "game_score" -> {
                    games++;
                    String game = String.valueOf(e.get("id"));
                    high.merge(game, value, Math::max);
                }
                case "reminder_done" -> remDone++;
                case "reminder_missed" -> remMissed++;
                case "alarm_missed" -> alarmMissed++;
                default -> {
                    // not counted
                }
            }
        }
        Map<String, Object> stats = in.stats == null ? Map.of() : in.stats;
        if (pomodoros == 0 && in.statsAreToday) {
            pomodoros = WatchRules.intOf(stats.get("pomodoros_today"), 0);
        }
        String dayText = in.day.toString();
        int memories = 0;
        for (String c : in.memoryCreated) {
            if (c != null && c.startsWith(dayText)) {
                memories++;
            }
        }
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("day", dayText);
        row.put("talkCount", in.talkCount);
        row.put("focusMinutes", pomodoros * Math.max(1, in.workMin));
        row.put("pomodoros", pomodoros);
        row.put("gamesPlayed", games);
        row.put("highScores", high);
        row.put("remindersDone", remDone);
        row.put("remindersMissed", remMissed);
        row.put("alarmsMissed", alarmMissed);
        row.put("newMemories", memories);
        Object mood = in.statsAreToday ? stats.get("mood") : null;
        row.put("mood", mood == null ? null : String.valueOf(mood));
        row.put("bondScore", in.statsAreToday && stats.get("bond_score") instanceof Number n ? n.intValue() : null);
        row.put("bondLevel", in.statsAreToday && stats.get("bond_level") instanceof Number n ? n.intValue() : null);
        return row;
    }

    /** The day in a few Bangla sentences (the app's voice: plain, no em dash). */
    public static String textBn(Map<String, Object> r, String name) {
        List<String> parts = new ArrayList<>();
        int talk = WatchRules.intOf(r.get("talkCount"), 0);
        int focus = WatchRules.intOf(r.get("focusMinutes"), 0);
        int games = WatchRules.intOf(r.get("gamesPlayed"), 0);
        if (talk > 0) {
            parts.add(BnText.digits(talk) + " বার কথা হয়েছে");
        }
        if (focus > 0) {
            parts.add(BnText.digits(focus) + " মিনিট মনোযোগ দিয়ে কাজ হয়েছে");
        }
        if (games > 0) {
            parts.add(BnText.digits(games) + "টি খেলা হয়েছে");
        }
        StringBuilder sb = new StringBuilder();
        if (parts.isEmpty()) {
            sb.append(name).append("-এর দিনটা শান্ত ছিল।");
        } else {
            sb.append(name).append("-এর সাথে ").append(String.join(", ", parts)).append("।");
        }
        int done = WatchRules.intOf(r.get("remindersDone"), 0);
        int missed = WatchRules.intOf(r.get("remindersMissed"), 0);
        if (done + missed > 0) {
            sb.append(" রিমাইন্ডার: ").append(BnText.digits(done)).append("টি নিশ্চিত");
            if (missed > 0) {
                sb.append(", ").append(BnText.digits(missed)).append("টিতে সাড়া মেলেনি");
            }
            sb.append("।");
        }
        int alarms = WatchRules.intOf(r.get("alarmsMissed"), 0);
        if (alarms > 0) {
            sb.append(" ").append(BnText.digits(alarms)).append("টি অ্যালার্ম কেউ বন্ধ করেনি।");
        }
        int mem = WatchRules.intOf(r.get("newMemories"), 0);
        if (mem > 0) {
            sb.append(" নতুন ").append(BnText.digits(mem)).append("টি কথা মনে রেখেছে।");
        }
        Object mood = r.get("mood");
        Object bond = r.get("bondScore");
        if (mood != null || bond != null) {
            sb.append(" ");
            if (mood != null) {
                sb.append("মেজাজ ").append(MOOD_BN.getOrDefault(String.valueOf(mood), String.valueOf(mood)));
            }
            if (bond != null) {
                sb.append(mood != null ? ", " : "").append("বন্ধুত্ব ").append(BnText.digits(bond));
            }
            sb.append("।");
        }
        return sb.toString();
    }

    public static String textEn(Map<String, Object> r, String name) {
        List<String> parts = new ArrayList<>();
        int talk = WatchRules.intOf(r.get("talkCount"), 0);
        int focus = WatchRules.intOf(r.get("focusMinutes"), 0);
        int games = WatchRules.intOf(r.get("gamesPlayed"), 0);
        if (talk > 0) {
            parts.add(talk + (talk == 1 ? " talk" : " talks"));
        }
        if (focus > 0) {
            parts.add(focus + " minutes of focus");
        }
        if (games > 0) {
            parts.add(games + (games == 1 ? " game" : " games"));
        }
        StringBuilder sb = new StringBuilder();
        if (parts.isEmpty()) {
            sb.append("A quiet day for ").append(name).append(".");
        } else {
            sb.append("With ").append(name).append(": ").append(String.join(", ", parts)).append(".");
        }
        int done = WatchRules.intOf(r.get("remindersDone"), 0);
        int missed = WatchRules.intOf(r.get("remindersMissed"), 0);
        if (done + missed > 0) {
            sb.append(" Reminders: ").append(done).append(" confirmed");
            if (missed > 0) {
                sb.append(", ").append(missed).append(" not answered");
            }
            sb.append(".");
        }
        int alarms = WatchRules.intOf(r.get("alarmsMissed"), 0);
        if (alarms > 0) {
            sb.append(" ").append(alarms).append(alarms == 1 ? " alarm was" : " alarms were").append(" not turned off.");
        }
        int mem = WatchRules.intOf(r.get("newMemories"), 0);
        if (mem > 0) {
            sb.append(" Remembered ").append(mem).append(mem == 1 ? " new thing." : " new things.");
        }
        Object mood = r.get("mood");
        Object bond = r.get("bondScore");
        if (mood != null || bond != null) {
            sb.append(" ");
            if (mood != null) {
                sb.append("Mood ").append(String.valueOf(mood).toLowerCase());
            }
            if (bond != null) {
                sb.append(mood != null ? ", " : "").append("bond ").append(bond);
            }
            sb.append(".");
        }
        return sb.toString();
    }
}
