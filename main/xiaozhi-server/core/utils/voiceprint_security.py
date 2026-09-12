"""Voiceprint Security & Speaker-Restricted Actions Enforcement Module

Provides speaker verification and role authorization for sensitive actions,
including system commands, device reboot, and smart home controls.
"""
import logging
from typing import Optional, Tuple, Dict, Any, List

logger = logging.getLogger(__name__)

# Tools that are inherently sensitive and require strict speaker authentication
SENSITIVE_TOOLS = {
    "device_reboot",
    "reboot",
    "device_bind",
    "device_unbind",
    "system_command",
    "ota_update",
    "factory_reset",
}

# Smart home domains and services requiring elevated security
SENSITIVE_SMART_HOME_DOMAINS = {"lock", "alarm_control_panel", "cover"}
SENSITIVE_SMART_HOME_SERVICES = {"unlock", "open", "disarm", "open_cover"}


async def verify_speaker_security(
    conn: Any,
    tool_name: str,
    arguments: Dict[str, Any],
) -> Tuple[bool, Optional[str]]:
    """Verifies whether the current speaker is authorized to execute the requested tool.

    Args:
        conn: ConnectionHandler instance
        tool_name: The name of the tool or plugin function being called
        arguments: The arguments dictionary passed to the tool

    Returns:
        (is_allowed: bool, refusal_reason: Optional[str])
    """
    voiceprint_config = {}
    if hasattr(conn, "config") and isinstance(conn.config, dict):
        voiceprint_config = conn.config.get("voiceprint", {}) or {}

    # If voiceprint is not configured at all, allow operation
    if not voiceprint_config:
        return True, None

    vp_provider = getattr(conn, "voiceprint_provider", None)

    # 1. Determine whether the requested tool is security-sensitive
    is_sensitive = tool_name in SENSITIVE_TOOLS
    is_smarthome = tool_name.startswith("hass_") or tool_name in {"smart_home", "iot_control"}

    is_sensitive_sh_action = False
    if is_smarthome and tool_name == "hass_set_state":
        domain = str(arguments.get("domain", "")).lower()
        service = str(arguments.get("service", "")).lower()
        entity_id = str(arguments.get("entity_id", "")).lower()

        if domain in SENSITIVE_SMART_HOME_DOMAINS or any(s in service for s in SENSITIVE_SMART_HOME_SERVICES):
            is_sensitive_sh_action = True
        elif "lock" in entity_id or "door" in entity_id:
            is_sensitive_sh_action = True

    require_smarthome_match = bool(voiceprint_config.get("require_voice_match_smart_home", False))
    admin_only = bool(voiceprint_config.get("admin_speaker_only", False))

    # Check whether this tool call needs speaker verification
    needs_verification = (
        is_sensitive
        or is_sensitive_sh_action
        or (is_smarthome and require_smarthome_match)
        or admin_only
    )

    if not needs_verification:
        return True, None

    # 2. Get or verify speaker identity
    current_speaker = getattr(conn, "current_speaker", None)

    # Live audio chunk verification fallback (Task 6.1)
    if (not current_speaker or current_speaker == "unknown_speaker") and vp_provider:
        last_audio = getattr(conn, "last_audio_pcm", None)
        if last_audio:
            wav_data = None
            if hasattr(conn, "asr") and hasattr(conn.asr, "_pcm_to_wav"):
                wav_data = conn.asr._pcm_to_wav(last_audio)
            elif hasattr(vp_provider, "_pcm_to_wav"):
                wav_data = vp_provider._pcm_to_wav(last_audio)

            if wav_data:
                try:
                    session_id = getattr(conn, "session_id", "security_check")
                    live_speaker = await vp_provider.identify_speaker(wav_data, session_id)
                    if live_speaker and live_speaker != "unknown_speaker":
                        conn.current_speaker = live_speaker
                        current_speaker = live_speaker
                except Exception as e:
                    logger.warning(f"Live voiceprint verification failed: {e}")

    # 3. Check if speaker is recognized
    if not current_speaker or current_speaker == "unknown_speaker":
        refusal_msg = (
            "Voiceprint verification failed: Unauthorized speaker. This action requires voice authentication. "
            "(ভয়েসপ্রিন্ট যাচাইকরণ ব্যর্থ হয়েছে: অননুমোদিত স্পিকার। এই নির্দেশ কার্যকর করতে নিবন্ধিত কণ্ঠস্বরের অনুমোদন প্রয়োজন।)"
        )
        return False, refusal_msg

    # 4. Enforce Admin Speaker Only policy (Task 6.2)
    needs_admin = is_sensitive or is_sensitive_sh_action or admin_only
    if needs_admin:
        admin_speakers: List[str] = list(voiceprint_config.get("admin_speakers", []))

        # Infer admin from configured speakers if not explicitly specified
        if not admin_speakers and "speakers" in voiceprint_config:
            for s in voiceprint_config.get("speakers", []):
                parts = s.split(",", 2)
                if len(parts) >= 2:
                    name = parts[1].strip()
                    intro = parts[2].strip() if len(parts) > 2 else ""
                    if any(k in name.lower() or k in intro.lower() for k in ["admin", "owner", "অ্যাডমিন"]):
                        admin_speakers.append(name)
            # Default to first registered speaker if no admin keyword found
            if not admin_speakers and len(voiceprint_config.get("speakers", [])) > 0:
                first_parts = voiceprint_config["speakers"][0].split(",", 2)
                if len(first_parts) >= 2:
                    admin_speakers.append(first_parts[1].strip())

        if admin_speakers and current_speaker not in admin_speakers:
            refusal_msg = (
                f"Access denied: Speaker '{current_speaker}' is not authorized as Admin for this sensitive action. "
                f"(অনুমতি প্রত্যাখ্যাত: '{current_speaker}' এই সংবেদনশীল কাজের জন্য অ্যাডমিন হিসেবে অনুমোদিত নয়।)"
            )
            return False, refusal_msg

    return True, None
