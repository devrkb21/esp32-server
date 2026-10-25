package xiaozhi.modules.device.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("OTA reply: companion API base URL")
class CompanionUrlTest {

    @Test
    void usesTheParamWhenSet() {
        assertEquals("http://192.168.0.123:8003",
                DeviceServiceImpl.companionBaseUrl("http://192.168.0.123:8003/", "http://x:9/mcp/vision/explain"));
        assertEquals("https://esp.czbd.app:18003",
                DeviceServiceImpl.companionBaseUrl(" https://esp.czbd.app:18003 ", null));
    }

    @Test
    void derivesFromVisionExplainOtherwise() {
        assertEquals("http://192.168.0.123:8003",
                DeviceServiceImpl.companionBaseUrl("null", "http://192.168.0.123:8003/mcp/vision/explain"));
        assertEquals("https://esp.czbd.app",
                DeviceServiceImpl.companionBaseUrl(null, "HTTPS://esp.czbd.app/mcp/vision/explain"));
        assertEquals("http://192.168.0.123:8003",
                DeviceServiceImpl.companionBaseUrl("not a url", "http://192.168.0.123:8003/mcp/vision/explain"));
    }

    @Test
    void nullWhenNothingUsable() {
        assertNull(DeviceServiceImpl.companionBaseUrl("null", "null"));
        assertNull(DeviceServiceImpl.companionBaseUrl(null, ""));
        assertNull(DeviceServiceImpl.companionBaseUrl(null, "ws://host:8000/xiaozhi/v1/"));
        assertNull(DeviceServiceImpl.companionBaseUrl(null, "/mcp/vision/explain"));
    }
}
