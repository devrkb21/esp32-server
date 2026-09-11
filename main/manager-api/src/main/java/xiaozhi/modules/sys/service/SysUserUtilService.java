package xiaozhi.modules.sys.service;


import java.util.function.Consumer;

/**
 * Define a system user utility class，Avoid circular dependency with user module
 * e.g., user and device mutually dependent，User needs to get all devices，Device query also needs username for each device
 * @author zjy
 * @since 2025-4-2
 */
public interface SysUserUtilService {
    /**
     * AssignUsername
     * @param userId Userid
     * @param setter Assignment method
     */
    void assignUsername( Long userId, Consumer<String> setter);
}
