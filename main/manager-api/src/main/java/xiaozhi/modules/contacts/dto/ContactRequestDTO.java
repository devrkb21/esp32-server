package xiaozhi.modules.contacts.dto;

import java.util.List;

import lombok.Data;

/**
 * Ask another account for a contact (deviceId: my robot, username: the other owner), accept one
 * (deviceId: my robot that will take part), or rename my side (name, aliases).
 */
@Data
public class ContactRequestDTO {
    private String deviceId;
    private String username;
    private String name;
    private List<String> aliases;
}
