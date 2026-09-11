package xiaozhi.modules.device.service;

import java.util.Date;
import java.util.List;
import java.util.Map;

import xiaozhi.common.page.PageData;
import xiaozhi.common.service.BaseService;
import xiaozhi.modules.device.dto.DeviceManualAddDTO;
import xiaozhi.modules.device.dto.DevicePageUserDTO;
import xiaozhi.modules.device.dto.DeviceReportReqDTO;
import xiaozhi.modules.device.dto.DeviceReportRespDTO;
import xiaozhi.modules.device.entity.DeviceEntity;
import xiaozhi.modules.device.vo.UserShowDeviceListVO;

public interface DeviceService extends BaseService<DeviceEntity> {
    /**
     * Get device online data
     */
    String getDeviceOnlineData(String agentId);

    /**
     * Check whether device is activated
     */
    DeviceReportRespDTO checkDeviceActive(String macAddress, String clientId,
            DeviceReportReqDTO deviceReport);

    /**
     * Get device list for user's specified agent，
     */
    List<DeviceEntity> getUserDevices(Long userId, String agentId);

    /**
     * Get device list for user's specified agent（With timezone handling），
     */
    List<UserShowDeviceListVO> getUserDeviceList(Long userId, String agentId);

    /**
     * UnbindDevice
     */
    void unbindDevice(Long userId, String deviceId);

    /**
     * DeviceActivate
     */
    Boolean deviceActivation(String agentId, String activationCode);

    /**
     * Delete all devices for this user
     * 
     * @param userId Userid
     */
    void deleteByUserId(Long userId);

    /**
     * Delete all devices associated with specified agent
     * 
     * @param agentId Agentid
     */
    void deleteByAgentId(String agentId);

    /**
     * Get device count for specified user
     * 
     * @param userId Userid
     * @return Device count
     */
    Long selectCountByUserId(Long userId);

    /**
     * Paginate get all device information
     *
     * @param dto PaginationFind parameter
     * @return User list pagination data
     */
    PageData<UserShowDeviceListVO> page(DevicePageUserDTO dto);

    /**
     * According toMACAddressGetDeviceInformation
     * 
     * @param macAddress MACAddress
     * @return DeviceInformation
     */
    DeviceEntity getDeviceByMacAddress(String macAddress);

    /**
     * According toDeviceIDGetActivateCode
     * 
     * @param deviceId DeviceID
     * @return ActivateCode
     */
    String geCodeByDeviceId(String deviceId);

    /**
     * Get the most recent last connection time for this agent's devices
     * 
     * @param agentId Agentid
     * @return Return the most recent last connection time of devices
     */
    Date getLatestLastConnectionTime(String agentId);

    /**
     * ManualAddDevice
     */
    void manualAddDevice(Long userId, DeviceManualAddDTO dto);

    /**
     * Update device connection info
     */
    void updateDeviceConnectionInfo(String agentId, String deviceId, String appVersion);

    /**
     * GenerateWebSocketAuthenticationtoken
     *
     * @param clientId ClientID
     * @param username Username(UsuallyasdeviceId)
     * @return AuthenticationtokenString
     * @throws Exception GeneratetokenwhenException
     */
    String generateWebSocketToken(String clientId, String username) throws Exception;

    /**
     * According toMACAddressSearchDevice
     *
     * @param macAddress MACAddressKeyword
     * @param userId     User ID
     * @return Device list
     */
    List<DeviceEntity> searchDevicesByMacAddress(String macAddress, Long userId);

    /**
     * Get device tool list
     */
    Object getDeviceTools(String deviceId);

    /**
     * CallDeviceTool
     */
    Object callDeviceTool(String deviceId, String toolName, Map<String, Object> arguments);

    }