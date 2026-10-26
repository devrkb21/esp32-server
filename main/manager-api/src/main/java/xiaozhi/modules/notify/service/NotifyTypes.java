package xiaozhi.modules.notify.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Notification types and the groups the owner switches on or off in the app.
 */
public final class NotifyTypes {
    private NotifyTypes() {
    }

    public static final String ROBOT_OFFLINE = "robot_offline";
    public static final String ALARM_MISSED = "alarm_missed";
    public static final String REMINDER_MISSED = "reminder_missed";
    public static final String CARE_NO_ACTIVITY = "care_no_activity";
    public static final String CARE_FALL = "care_fall";
    public static final String CARE_MEDICINE = "care_medicine";
    public static final String DAILY_SUMMARY = "daily_summary";
    public static final String FAMILY_INVITE = "family_invite";
    public static final String FAMILY_JOINED = "family_joined";
    public static final String TEST = "test";

    public static final String G_OFFLINE = "offline";
    public static final String G_ALARM = "alarm";
    public static final String G_REMINDER = "reminder";
    public static final String G_CARE = "care";
    public static final String G_SUMMARY = "summary";
    public static final String G_FAMILY = "family";

    /** Every group, in the order the app lists them. */
    public static final List<String> GROUPS = List.of(G_OFFLINE, G_ALARM, G_REMINDER, G_CARE, G_SUMMARY, G_FAMILY);

    private static final Map<String, String> GROUP_OF = new LinkedHashMap<>();
    static {
        GROUP_OF.put(ROBOT_OFFLINE, G_OFFLINE);
        GROUP_OF.put(ALARM_MISSED, G_ALARM);
        GROUP_OF.put(REMINDER_MISSED, G_REMINDER);
        GROUP_OF.put(CARE_NO_ACTIVITY, G_CARE);
        GROUP_OF.put(CARE_FALL, G_CARE);
        GROUP_OF.put(CARE_MEDICINE, G_CARE);
        GROUP_OF.put(DAILY_SUMMARY, G_SUMMARY);
        GROUP_OF.put(FAMILY_INVITE, G_FAMILY);
        GROUP_OF.put(FAMILY_JOINED, G_FAMILY);
    }

    /** The group of a type; null for types that always reach the user (test). */
    public static String groupOf(String type) {
        return GROUP_OF.get(type);
    }
}
