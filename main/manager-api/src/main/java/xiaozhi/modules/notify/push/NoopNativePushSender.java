package xiaozhi.modules.notify.push;

import java.util.Map;

import org.springframework.stereotype.Component;

/**
 * Native push is not configured: tokens are stored, nothing is sent (see NativePushSender).
 */
@Component
public class NoopNativePushSender implements NativePushSender {
    @Override
    public boolean enabled() {
        return false;
    }

    @Override
    public boolean send(String provider, String token, Map<String, Object> payload) {
        return true;
    }
}
