package xiaozhi.modules.family.service;

import xiaozhi.common.utils.SpringContextUtils;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.family.service.FamilyRole.Action;

/**
 * Static entry to {@link DeviceAccessService} for the older device, agent and voiceprint classes,
 * so routing their ownership checks through family roles does not change their constructors
 * (other code and tests build them by hand). Without a Spring context (plain unit tests) it
 * falls back to the old rule: only the owner.
 */
public final class DeviceAccess {
    private static volatile DeviceAccessService override;

    private DeviceAccess() {
    }

    /** For tests: use this service instead of the Spring bean (null: back to the bean). */
    public static void use(DeviceAccessService service) {
        override = service;
    }

    static DeviceAccessService service() {
        if (override != null) {
            return override;
        }
        try {
            if (SpringContextUtils.applicationContext != null) {
                return SpringContextUtils.getBean(DeviceAccessService.class);
            }
        } catch (Exception ignored) {
            // no bean (partial context): fall back
        }
        return null;
    }

    public static FamilyRole roleOf(DeviceEntity device, Long userId) {
        DeviceAccessService s = service();
        if (s != null) {
            return s.roleOf(device, userId);
        }
        return device != null && userId != null && userId.equals(device.getUserId()) ? FamilyRole.OWNER
                : FamilyRole.NONE;
    }

    public static boolean can(DeviceEntity device, Long userId, Action action) {
        return roleOf(device, userId).allows(action);
    }

    /**
     * The role on a character. {@code ownerId} is the agent's user id, used for the fallback
     * without a Spring context.
     */
    public static FamilyRole agentRole(String agentId, Long ownerId, Long userId) {
        DeviceAccessService s = service();
        if (s != null) {
            return s.agentRole(agentId, userId);
        }
        return ownerId != null && ownerId.equals(userId) ? FamilyRole.OWNER : FamilyRole.NONE;
    }

    public static boolean canAgent(String agentId, Long ownerId, Long userId, Action action) {
        return agentRole(agentId, ownerId, userId).allows(action);
    }

    /** Drops the shares of a robot that was unbound (no-op without a context). */
    public static void forgetDevice(String deviceId) {
        DeviceAccessService s = service();
        if (s != null) {
            s.forgetDevice(deviceId);
        }
    }

    /** Robots shared with the user (empty without a context). */
    public static java.util.List<String> sharedDeviceIds(Long userId) {
        DeviceAccessService s = service();
        return s == null ? java.util.Collections.emptyList() : s.sharedDeviceIds(userId);
    }

    /** The owner of a character, or null. */
    public static Long agentOwner(String agentId) {
        DeviceAccessService s = service();
        return s == null ? null : s.agentOwner(agentId);
    }
}
