package xiaozhi.modules.shopbridge;

import java.security.SecureRandom;
import java.util.Base64;

import org.apache.commons.lang3.StringUtils;
import org.springframework.core.env.Environment;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import xiaozhi.common.exception.ErrorCode;
import xiaozhi.common.exception.RenException;
import xiaozhi.common.page.TokenDTO;
import xiaozhi.common.redis.RedisUtils;
import xiaozhi.common.utils.JsonUtils;
import xiaozhi.modules.security.service.SysUserTokenService;
import xiaozhi.modules.sys.dto.SysUserDTO;
import xiaozhi.modules.sys.service.SysUserService;

/**
 * Signs TinyBot shop customers into manager-api. The shop has already proved who the customer is (an
 * SMS code to their order's phone), so here a phone number is enough: the account under that number
 * (in any stored form) is used, or made with a random ***REDACTED*** the customer never needs, since they
 * always come in through the shop. The token is manager-api's normal user token, so every existing
 * API and screen works unchanged.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShopBridgeService {
    static final String HANDOFF_KEY = "shopbridge:handoff:";
    static final long HANDOFF_SECONDS = 60;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SysUserService sysUserService;
    private final SysUserTokenService sysUserTokenService;
    private final RedisUtils redisUtils;
    private final Environment env;

    public record Session(Long userId, String username, boolean created, TokenDTO token) {
    }

    /** A customer's token, by phone; the account is made the first time. */
    public Session customer(String phone) {
        var forms = ShopBridgePhone.variants(phone);
        if (forms.isEmpty()) {
            throw new RenException(ErrorCode.USERNAME_NOT_PHONE);
        }
        SysUserDTO user = find(forms);
        boolean created = false;
        if (user == null) {
            SysUserDTO dto = new SysUserDTO();
            dto.setUsername(forms.get(0));
            dto.setMobile(forms.get(0));
            dto.setPassword(randomPassword());
            try {
                sysUserService.save(dto);
                created = true;
            } catch (DuplicateKeyException e) {
                // the same customer signed in twice at once: the other request made the account
                log.info("shop bridge: account for {} was made concurrently", mask(forms.get(0)));
            }
            user = find(forms);
            if (user == null) {
                throw new RenException(ErrorCode.UNAUTHORIZED);
            }
        }
        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new RenException(ErrorCode.FORBIDDEN);
        }
        TokenDTO token = sysUserTokenService.createToken(user.getId()).getData();
        return new Session(user.getId(), user.getUsername(), created, token);
    }

    /** The admin account the shop's admin pages act as (SHOP_BRIDGE_ADMIN, a super admin). */
    public TokenDTO admin() {
        String username = StringUtils.trimToEmpty(env.getProperty("SHOP_BRIDGE_ADMIN", ""));
        SysUserDTO user = username.isEmpty() ? null : sysUserService.getByUsername(username);
        if (user == null || user.getSuperAdmin() == null || user.getSuperAdmin() != 1
                || (user.getStatus() != null && user.getStatus() == 0)) {
            throw new RenException(ErrorCode.FORBIDDEN);
        }
        return sysUserTokenService.createToken(user.getId()).getData();
    }

    /** A one-time code that lets the customer's browser open the dashboard signed in. */
    public String handoff(String phone) {
        Session s = customer(phone);
        String code = randomCode();
        redisUtils.set(HANDOFF_KEY + code, JsonUtils.toJsonString(s.token()), HANDOFF_SECONDS);
        return code;
    }

    /** Swap a handoff code for its token, once. */
    public TokenDTO redeem(String code) {
        if (code == null || !code.matches("[A-Za-z0-9_-]{32,64}")) {
            throw new RenException(ErrorCode.UNAUTHORIZED);
        }
        String key = HANDOFF_KEY + code;
        Object stored = redisUtils.get(key);
        redisUtils.delete(key);
        if (stored == null) {
            throw new RenException(ErrorCode.UNAUTHORIZED);
        }
        return JsonUtils.parseObject(stored.toString(), TokenDTO.class);
    }

    private SysUserDTO find(java.util.List<String> forms) {
        for (String f : forms) {
            SysUserDTO u = sysUserService.getByUsername(f);
            if (u != null) {
                return u;
            }
        }
        return null;
    }

    static String randomCode() {
        byte[] b = new byte[32];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    /** Meets the account rule (a digit, a lower and an upper case letter); never shown to anyone. */
    static String randomPassword() {
        return "Tb9" + randomCode() + "aZ";
    }

    private static String mask(String phone) {
        return phone.length() > 4 ? "…" + phone.substring(phone.length() - 4) : "…";
    }
}
