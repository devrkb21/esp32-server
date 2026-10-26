package xiaozhi.modules.family.service;

import java.util.List;

import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.family.service.FamilyRole.Action;

/**
 * The one place that answers "may this account do this with this robot?". Every ownership
 * check (device, companion forward, link, voiceprint, chat history, character) goes through it,
 * so family members and co-owners get exactly the rights of their role (see {@link FamilyRole}).
 */
public interface DeviceAccessService {

    /** The account's role on the robot (NONE when it has none). */
    FamilyRole roleOf(DeviceEntity device, Long userId);

    FamilyRole roleOf(String deviceId, Long userId);

    boolean can(DeviceEntity device, Long userId, Action action);

    /**
     * The device when the account may do {@code action} with it. Throws DEVICE_NOT_EXIST when the
     * account has no role at all (the robot stays invisible), NO_PERMISSION when the role is too
     * weak.
     */
    DeviceEntity require(String deviceId, Long userId, Action action);

    /**
     * The account's role on a character: OWNER when it owns the agent, otherwise the strongest
     * role it has on a robot that runs this character.
     */
    FamilyRole agentRole(String agentId, Long userId);

    boolean canAgent(String agentId, Long userId, Action action);

    /** The owner of a character (ai_agent.user_id), or null. */
    Long agentOwner(String agentId);

    /** Ids of the robots shared with the account (accepted invites). */
    List<String> sharedDeviceIds(Long userId);

    /** Everyone who hears about the robot: the owner, then the accepted family, no duplicates. */
    List<Long> audience(DeviceEntity device);

    /** Drops every share of a robot (it was unbound or deleted). */
    void forgetDevice(String deviceId);
}
