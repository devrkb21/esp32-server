package xiaozhi.modules.shopbridge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class ShopBridgeTest {

    @Test
    void phoneIsLookedUpInEveryForm() {
        assertEquals(List.of("01712345678", "8801712345678", "+8801712345678"), ShopBridgePhone.variants("01712345678"));
        assertEquals("01712345678", ShopBridgePhone.canonical("+880 1712-345678"));
        assertEquals("01712345678", ShopBridgePhone.canonical("8801712345678"));
        assertEquals(List.of("+447700900123"), ShopBridgePhone.variants("+447700900123"));
    }

    @Test
    void notAPhoneIsRefused() {
        assertNull(ShopBridgePhone.canonical(null));
        assertNull(ShopBridgePhone.canonical("01212345678"));
        assertNull(ShopBridgePhone.canonical("admin"));
        assertTrue(ShopBridgePhone.variants("1234").isEmpty());
    }

    @Test
    void secretMustMatchExactly() {
        assertTrue(ShopBridgeFilter.matches("s3cret-value", "s3cret-value"));
        assertFalse(ShopBridgeFilter.matches("s3cret-value", "s3cret-valu"));
        assertFalse(ShopBridgeFilter.matches("s3cret-value", null));
        assertFalse(ShopBridgeFilter.matches("", ""));
        assertFalse(ShopBridgeFilter.matches(null, "x"));
    }

    @Test
    void bridgeRulesComeBeforeTheCatchAll() {
        Map<String, String> upstream = new LinkedHashMap<>();
        upstream.put("/user/login", "anon");
        upstream.put("/config/**", "server");
        upstream.put("/**", "oauth2");
        var keys = List.copyOf(ShopBridgeShiroConfig.withBridgeRules(upstream).keySet());
        assertEquals(List.of("/shop-bridge/redeem", "/shop-bridge/**", "/user/login", "/config/**", "/**"), keys);
        assertEquals("anon", ShopBridgeShiroConfig.withBridgeRules(upstream).get("/shop-bridge/redeem"));
    }

    @Test
    void codesAndPasswordsAreRandomAndValid() {
        String a = ShopBridgeService.randomCode();
        assertTrue(a.matches("[A-Za-z0-9_-]{32,64}"));
        assertFalse(a.equals(ShopBridgeService.randomCode()));
        assertTrue(ShopBridgeService.randomPassword().matches("^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).+$"));
    }
}
