package xiaozhi.modules.family.service;

import java.util.List;
import java.util.Map;

/**
 * Family sharing: the owner invites another account (by username or phone number) as a member
 * or co-owner of one robot; the invitee accepts or declines; the owner changes roles and removes
 * people; anyone shared can leave. Shapes are documented in docs/family-and-notifications.md.
 */
public interface FamilyService {

    /** Robots shared with the user (accepted). */
    List<Map<String, Object>> sharedRobots(Long userId);

    /** {role, canShare, ownerName, members:[...]} for one robot the user has a role on. */
    Map<String, Object> deviceFamily(String deviceId, Long userId);

    /** Invites {@code target} (username or phone) as {@code role}; returns the member row. */
    Map<String, Object> invite(String deviceId, Long userId, String target, String role);

    void changeRole(Long shareId, Long userId, String role);

    /** The owner removes anyone (or cancels an invite); a member removes their own row. */
    void remove(Long shareId, Long userId);

    /** Pending invitations to the user. */
    List<Map<String, Object>> invites(Long userId);

    void respond(Long shareId, Long userId, boolean accept);
}
