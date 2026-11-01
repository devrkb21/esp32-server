package xiaozhi.modules.shopbridge;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.apache.commons.lang3.StringUtils;
import org.apache.shiro.web.filter.AccessControlFilter;
import org.springframework.web.bind.annotation.RequestMethod;

import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.common.utils.Result;

/**
 * Guards /shop-bridge/**: only the TinyBot shop's server, holding SHOP_BRIDGE_SECRET, gets in. A
 * secret of its own (not ***REDACTED***), so the shop cannot read robot configs and the speech server
 * cannot sign people in. With no secret configured every call is refused.
 */
@Slf4j
public class ShopBridgeFilter extends AccessControlFilter {
    private final String secret;

    public ShopBridgeFilter(String secret) {
        this.secret = StringUtils.trimToEmpty(secret);
    }

    @Override
    protected boolean isAccessAllowed(ServletRequest request, ServletResponse response, Object mappedValue) {
        HttpServletRequest http = (HttpServletRequest) request;
        if (RequestMethod.OPTIONS.name().equals(http.getMethod())) {
            return true;
        }
        return matches(secret, bearer(http));
    }

    @Override
    protected boolean onAccessDenied(ServletRequest request, ServletResponse response) {
        HttpServletResponse http = (HttpServletResponse) response;
        http.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        http.setContentType("application/json;charset=utf-8");
        try {
            String msg = secret.isEmpty() ? "Shop bridge is not configured" : "Invalid shop bridge secret";
            http.getWriter().print(JsonUtils.toJsonString(new Result<Void>().error(ErrorCode.UNAUTHORIZED, msg)));
        } catch (IOException e) {
            log.error("shop bridge: writing the 401 failed", e);
        }
        return false;
    }

    /** Constant-time comparison; an empty secret never matches. */
    static boolean matches(String expected, String given) {
        if (StringUtils.isEmpty(expected) || given == null) {
            return false;
        }
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
    }

    private static String bearer(HttpServletRequest request) {
        String h = request.getHeader("Authorization");
        return h != null && h.startsWith("Bearer ") ? h.substring(7).trim() : null;
    }
}
