package xiaozhi.modules.home.dto;

import java.util.List;

import lombok.Data;

/** A device as the apps send it (new MQTT device, or an edit of any device). */
@Data
public class HomeDeviceDTO {
    /** ha or mqtt (only on create; imported devices come from Home Assistant) */
    private String source;
    private String entityId;
    private String domain;
    private String name;
    private List<String> aliases;
    private String topic;
    private String payloadOn;
    private String payloadOff;
    private Boolean enabled;
}
