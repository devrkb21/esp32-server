package xiaozhi.modules.notify.service;

import lombok.Data;
import lombok.experimental.Accessors;

/**
 * One notification to create, in both languages. {@code dedupeKey}: when set, a user gets at
 * most one notification with this key (the robot watch runs every few minutes and must not
 * repeat itself).
 */
@Data
@Accessors(chain = true)
public class NotifyMessage {
    private String type;
    private String titleBn;
    private String titleEn;
    private String bodyBn;
    private String bodyEn;
    private String deviceId;
    private String robotName;
    private String dedupeKey;

    public static NotifyMessage of(String type) {
        return new NotifyMessage().setType(type);
    }

    public NotifyMessage title(String bn, String en) {
        return setTitleBn(bn).setTitleEn(en);
    }

    public NotifyMessage body(String bn, String en) {
        return setBodyBn(bn).setBodyEn(en);
    }
}
