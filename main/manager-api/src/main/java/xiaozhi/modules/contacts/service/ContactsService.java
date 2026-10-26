package xiaozhi.modules.contacts.service;

import java.util.List;
import java.util.Map;

import xiaozhi.modules.contacts.dto.ContactRequestDTO;

/**
 * Robot-to-robot voice messages. Robots of the same owner may always message each other; robots
 * of two owners need a contact both owners agreed to (one asks, the other accepts).
 */
public interface ContactsService {
    /** Product feature key: robots whose product has it may send robot-to-robot messages. */
    String FEATURE = "robot_messages";
    int MAX_NAME = 32;
    int MAX_TEXT = 300;

    /**
     * The owner's view: {robots: [{deviceId, name}], contacts: [{id, status, direction (out|in),
     * myDeviceId, myDeviceName, name, aliases, otherOwner, otherDeviceName, createdAt}]}.
     */
    Map<String, Object> overview(Long userId);

    Map<String, Object> request(Long userId, ContactRequestDTO dto);

    Map<String, Object> accept(Long userId, Long id, ContactRequestDTO dto);

    void decline(Long userId, Long id);

    Map<String, Object> rename(Long userId, Long id, ContactRequestDTO dto);

    void remove(Long userId, Long id);

    /**
     * Who a robot may message: [{key, name, aliases, kind (own|contact)}]; key "d:<deviceId>" for
     * the owner's other robots, "c:<contactId>" for contacts.
     */
    List<Map<String, Object>> targets(Long userId, String deviceId);

    /**
     * Sends a spoken message from one robot to another. {ok, code, to, later, message} where code
     * is ok, not_found, not_supported, too_long, empty, unreachable or not_registered.
     */
    Map<String, Object> send(Long userId, String fromDeviceId, String target, String text);
}
