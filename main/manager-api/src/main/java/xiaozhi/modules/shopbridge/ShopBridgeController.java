package xiaozhi.modules.shopbridge;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import xiaozhi.common.page.TokenDTO;
import xiaozhi.common.utils.Result;

/**
 * The TinyBot shop's door into manager-api (see UPSTREAM.md, "The shop bridge"). Everything here
 * except /redeem needs SHOP_BRIDGE_SECRET (ShopBridgeShiroConfig); the shop calls it from its server,
 * never from a browser.
 */
@RestController
@RequestMapping("/shop-bridge")
@RequiredArgsConstructor
@Tag(name = "Shop bridge (TinyBot shop)")
public class ShopBridgeController {
    private final ShopBridgeService service;

    @PostMapping("/session")
    @Operation(summary = "A customer's token by phone; the account is made if missing (shop secret)")
    public Result<Map<String, Object>> session(@RequestBody Map<String, String> body) {
        ShopBridgeService.Session s = service.customer(body.get("phone"));
        return new Result<Map<String, Object>>().ok(Map.of(
                "userId", s.userId(),
                "username", s.username(),
                "created", s.created(),
                "token", s.token()));
    }

    @PostMapping("/admin-session")
    @Operation(summary = "The token of the admin account SHOP_BRIDGE_ADMIN (shop secret)")
    public Result<TokenDTO> adminSession() {
        return new Result<TokenDTO>().ok(service.admin());
    }

    @PostMapping("/handoff")
    @Operation(summary = "A one-time code (60 s) that opens the dashboard signed in (shop secret)")
    public Result<Map<String, Object>> handoff(@RequestBody Map<String, String> body) {
        return new Result<Map<String, Object>>().ok(Map.of(
                "code", service.handoff(body.get("phone")),
                "expiresIn", ShopBridgeService.HANDOFF_SECONDS));
    }

    @PostMapping("/redeem")
    @Operation(summary = "Swap a one-time code for its token (the dashboard's #/sso page; no secret)")
    public Result<TokenDTO> redeem(@RequestBody Map<String, String> body) {
        return new Result<TokenDTO>().ok(service.redeem(body.get("code")));
    }
}
