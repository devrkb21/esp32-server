package xiaozhi.modules.device.service;

import java.util.List;
import java.util.Map;

import xiaozhi.modules.device.entity.DeviceAddressBookEntity;

public interface DeviceAddressBookService {

    /**
     * Get device contact list
     */
    List<DeviceAddressBookEntity> getAddressBookList(String macAddress);

    /**
     * Get contacts for all devices（GlobalCacheuse）
     */
    Map<String, Map<String, String>> getAllAddressBooks();

    /**
     * UpdateAlias
     */
    void updateAlias(String macAddress, String targetMac, String alias);

    /**
     * UpdatePermission
     */
    void updatePermission(String macAddress, String targetMac, Boolean hasPermission);

    /**
     * Add or update contact record
     */
    void saveOrUpdate(String macAddress, String targetMac, String alias, Boolean hasPermission);

    /**
     * refreshNewContactsCache
     */
    void refreshCache();

    /**
     * Initiate call by nickname
     * @param callerMac CallerMACAddress
     * @param nickname Callee nickname
     * @param isAnswer WhetherasAnswerMode（Skip permissionsCheck）
     */
    Map<String, Object> callByNickname(String callerMac, String nickname, boolean isAnswer);

    /**
     * Batch delete contact records related to devices
     */
    void deleteByMacAddresses(List<String> macAddresses);
}