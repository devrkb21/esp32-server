package xiaozhi.modules.home.dto;

import lombok.Data;

/**
 * One action on a device: on, off, toggle, open, close, stop, set_temperature (value: degrees),
 * set_brightness or set_speed (value: percent). From the server: mac names the talking robot.
 */
@Data
public class HomeActionDTO {
    private String mac;
    private String deviceId;
    private String action;
    private Double value;
}
