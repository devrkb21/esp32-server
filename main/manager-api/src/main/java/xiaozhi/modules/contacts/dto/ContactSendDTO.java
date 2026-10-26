package xiaozhi.modules.contacts.dto;

import lombok.Data;

/**
 * A spoken message from one robot to another. From the app: fromDeviceId (my robot) and target
 * (a key from the targets list: "d:<deviceId>" for my own robots, "c:<contactId>" for a contact).
 * From the server: mac names the talking robot instead of fromDeviceId.
 */
@Data
public class ContactSendDTO {
    private String mac;
    private String fromDeviceId;
    private String target;
    private String text;
}
