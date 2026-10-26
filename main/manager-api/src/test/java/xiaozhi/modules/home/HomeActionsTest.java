package xiaozhi.modules.home;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.junit.jupiter.api.Test;

import xiaozhi.modules.home.service.HomeActions;
import xiaozhi.modules.home.service.HomeSecretBox;

class HomeActionsTest {

    @Test
    void lightsSwitchesAndFansTurnOnAndOff() {
        assertEquals("light.turn_off", HomeActions.haCall("light", "off", null).name());
        assertEquals("light.turn_on", HomeActions.haCall("light", "ON", null).name());
        assertEquals("switch.toggle", HomeActions.haCall("switch", "toggle", null).name());
        assertEquals("fan.turn_on", HomeActions.haCall("fan", "on", null).name());
        assertTrue(HomeActions.haCall("fan", "on", null).data().isEmpty());
    }

    @Test
    void climateTakesATemperatureInRange() {
        HomeActions.ServiceCall c = HomeActions.haCall("climate", "set_temperature", 24.0);
        assertEquals("climate.set_temperature", c.name());
        assertEquals(Map.of("temperature", 24), c.data());
        assertEquals(Map.of("temperature", 23.5), HomeActions.haCall("climate", "set_temperature", 23.5).data());
        assertEquals("bad_value", assertThrows(IllegalArgumentException.class,
                () -> HomeActions.haCall("climate", "set_temperature", 45)).getMessage());
        assertEquals("bad_value", assertThrows(IllegalArgumentException.class,
                () -> HomeActions.haCall("climate", "set_temperature", null)).getMessage());
        assertEquals("climate.turn_off", HomeActions.haCall("climate", "off", null).name());
    }

    @Test
    void brightnessSpeedAndCovers() {
        assertEquals(Map.of("brightness_pct", 40), HomeActions.haCall("light", "set_brightness", 40).data());
        assertEquals("fan.set_percentage", HomeActions.haCall("fan", "set_speed", 66).name());
        assertEquals("cover.open_cover", HomeActions.haCall("cover", "open", null).name());
        assertEquals("cover.close_cover", HomeActions.haCall("cover", "off", null).name());
    }

    @Test
    void actionsThatDoNotFitAreRefused() {
        assertEquals("unsupported", assertThrows(IllegalArgumentException.class,
                () -> HomeActions.haCall("switch", "set_temperature", 24)).getMessage());
        assertEquals("unsupported", assertThrows(IllegalArgumentException.class,
                () -> HomeActions.haCall("lock", "off", null)).getMessage());
    }

    @Test
    void mqttUsesTheDevicePayloads() {
        assertEquals("1", HomeActions.mqttPayload("on", "1", "0"));
        assertEquals("0", HomeActions.mqttPayload("off", "1", "0"));
        assertEquals("ON", HomeActions.mqttPayload("on", "", null));
        assertThrows(IllegalArgumentException.class, () -> HomeActions.mqttPayload("set_temperature", "1", "0"));
    }

    @Test
    void secretsAreSealedAndOnlyTheRightKeyOpensThem() {
        HomeSecretBox box = new HomeSecretBox("key-one");
        String sealed = box.seal("eyJhbGciOi.secret-token");
        assertNotNull(sealed);
        assertTrue(sealed.startsWith("v1:"));
        assertTrue(!sealed.contains("secret-token"));
        assertEquals("eyJhbGciOi.secret-token", box.open(sealed));
        assertNull(new HomeSecretBox("key-two").open(sealed));
        assertNull(box.seal(""));
        assertNull(box.open("plain"));
    }
}
