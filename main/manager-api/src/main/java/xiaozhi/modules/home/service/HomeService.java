package xiaozhi.modules.home.service;

import java.util.List;
import java.util.Map;

import xiaozhi.modules.home.dto.HomeDeviceDTO;
import xiaozhi.modules.home.dto.HomeIntegrationDTO;

/**
 * Smart home per user: the Home Assistant / MQTT integration (secrets stay here, encrypted, and are
 * never returned) and the devices the robot may switch by voice.
 */
public interface HomeService {
    /** Product feature key: robots whose product has it may use the smart-home voice tool. */
    String FEATURE = "smart_home";

    /**
     * {ha: {baseUrl, tokenSaved}, mqtt: {host, port, username, passwordSaved, tls}, deviceCount}
     */
    Map<String, Object> getIntegration(Long userId);

    Map<String, Object> saveIntegration(Long userId, HomeIntegrationDTO dto);

    /** target: ha or mqtt. HomeResult map: {ok, code, message, version?}. */
    Map<String, Object> test(Long userId, String target);

    /** Reads lights, switches, fans, climate and covers from Home Assistant into the device list. */
    Map<String, Object> importHa(Long userId);

    List<Map<String, Object>> listDevices(Long userId, boolean enabledOnly);

    Map<String, Object> saveDevice(Long userId, Long id, HomeDeviceDTO dto);

    void deleteDevice(Long userId, Long id);

    /** Runs an action on one of the user's devices. HomeResult map plus {device, action}. */
    Map<String, Object> act(Long userId, Long deviceId, String action, Double value);
}
