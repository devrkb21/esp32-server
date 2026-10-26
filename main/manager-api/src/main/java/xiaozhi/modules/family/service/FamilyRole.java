package xiaozhi.modules.family.service;

/**
 * What an account may do with a robot. The owner is ai_device.user_id; co-owners and members
 * come from accepted family invites (ai_device_share).
 *
 * <pre>
 *            VIEW  USE  MANAGE  DELETE  SHARE
 * owner        x    x     x       x       x
 * co_owner     x    x     x
 * member       x    x
 * </pre>
 *
 * VIEW: see the robot, its character and chat history. USE: Today, Day, Messages, Look (the
 * companion API), volume and restart. MANAGE: rename, change the character, voiceprints, the
 * address book, link a robot to its character. DELETE: unbind the robot or delete its
 * character. SHARE: invite people, change their role, remove them.
 */
public enum FamilyRole {
    OWNER("owner", 3), CO_OWNER("co_owner", 2), MEMBER("member", 1), NONE("none", 0);

    public enum Action {
        VIEW, USE, MANAGE, DELETE, SHARE
    }

    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_ACCEPTED = "accepted";
    public static final String STATUS_DECLINED = "declined";

    private final String key;
    private final int rank;

    FamilyRole(String key, int rank) {
        this.key = key;
        this.rank = rank;
    }

    public String key() {
        return key;
    }

    public boolean allows(Action action) {
        if (action == null) {
            return false;
        }
        return switch (action) {
            case VIEW, USE -> rank >= MEMBER.rank;
            case MANAGE -> rank >= CO_OWNER.rank;
            case DELETE, SHARE -> this == OWNER;
        };
    }

    /** The role of a share row ("member" / "co_owner"); anything else is NONE. */
    public static FamilyRole ofShare(String key) {
        if (MEMBER.key.equals(key)) {
            return MEMBER;
        }
        if (CO_OWNER.key.equals(key)) {
            return CO_OWNER;
        }
        return NONE;
    }

    /** A role that can be given through an invite. */
    public static boolean isInvitable(String key) {
        return MEMBER.key.equals(key) || CO_OWNER.key.equals(key);
    }

    public static FamilyRole stronger(FamilyRole a, FamilyRole b) {
        if (a == null) {
            return b == null ? NONE : b;
        }
        if (b == null) {
            return a;
        }
        return a.rank >= b.rank ? a : b;
    }
}
