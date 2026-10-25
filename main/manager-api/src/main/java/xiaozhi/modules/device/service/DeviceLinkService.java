package xiaozhi.modules.device.service;

import java.util.List;

import org.apache.commons.lang3.StringUtils;

import xiaozhi.modules.device.dto.DeviceLinkDTO;
import xiaozhi.modules.device.vo.DeviceLinkInfoVO;
import xiaozhi.modules.device.vo.DeviceLinkResultVO;

/**
 * "Link this robot to my account": an unbound robot shows a 6-digit code (and a QR of
 * {@link #buildLinkUrl}); a signed-in owner looks the code up and links the robot in one step.
 */
public interface DeviceLinkService {

    /** Path (hash route) of the web app's link page. */
    String LINK_PATH = "/#/link?code=";

    /**
     * Looks up a pending link code (the OTA activation cache). Never returns secrets or the full
     * MAC address.
     *
     * @throws xiaozhi.common.exception.RenException DEVICE_LINK_CODE_FORMAT when the code is not 6
     *         digits, DEVICE_LINK_CODE_EXPIRED when it is unknown or has expired
     */
    DeviceLinkInfoVO lookup(String code);

    /**
     * Links the robot behind the code to the signed-in user. Without an agent id the user's only
     * character is used; with none, a default character is created from the default template;
     * with several, DEVICE_LINK_CHOOSE_AGENT is thrown so the app can ask which one.
     */
    DeviceLinkResultVO link(Long userId, DeviceLinkDTO dto);

    /**
     * The URL the robot shows as a QR: {@code <frontedUrl without trailing slash>/#/link?code=<code>}.
     * Returns null when the control panel URL is not configured.
     */
    static String buildLinkUrl(String frontedUrl, String code) {
        if (StringUtils.isBlank(frontedUrl) || StringUtils.isBlank(code)) {
            return null;
        }
        String base = frontedUrl.trim();
        if ("null".equalsIgnoreCase(base)) {
            return null;
        }
        base = base.replaceAll("/+$", "");
        if (base.isEmpty()) {
            return null;
        }
        return base + LINK_PATH + code;
    }

    /** Normalizes user input to the 6-digit code, or returns null when it is not 6 digits. */
    static String normalizeCode(String raw) {
        if (raw == null) {
            return null;
        }
        String digits = raw.replaceAll("\\s+", "");
        return digits.matches("\\d{6}") ? digits : null;
    }

    /** Which character the robot should be linked to. */
    enum AgentChoice {
        /** The requested agent id (already checked to belong to the user). */
        REQUESTED,
        /** The user's only character. */
        ONLY,
        /** The user has no character: create a default one. */
        CREATE,
        /** Several characters and none requested: the app must ask. */
        ASK
    }

    /**
     * Pure decision: what to do given the user's agent ids and the (optional) requested one.
     * A requested id that is not among the user's agents yields null (caller rejects it).
     */
    static AgentChoice decideAgent(List<String> userAgentIds, String requestedAgentId) {
        List<String> ids = userAgentIds == null ? List.of() : userAgentIds;
        if (StringUtils.isNotBlank(requestedAgentId)) {
            return ids.contains(requestedAgentId) ? AgentChoice.REQUESTED : null;
        }
        if (ids.isEmpty()) {
            return AgentChoice.CREATE;
        }
        if (ids.size() == 1) {
            return AgentChoice.ONLY;
        }
        return AgentChoice.ASK;
    }
}
