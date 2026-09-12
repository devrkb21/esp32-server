"""Unit tests for Voiceprint Security and Speaker-Restricted Actions Enforcement
"""
import sys
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

_SERVER_ROOT = str(Path(__file__).resolve().parent.parent)
_TESTS_DIR = str(Path(__file__).resolve().parent)
while _TESTS_DIR in sys.path:
    sys.path.remove(_TESTS_DIR)
sys.path.insert(0, _SERVER_ROOT)

from core.utils.voiceprint_security import verify_speaker_security
from plugins_func.register import Action, ActionResponse
from core.providers.tools.server_plugins.plugin_executor import ServerPluginExecutor


class MockConnection:
    def __init__(self, voiceprint_config=None, current_speaker=None, last_audio_pcm=None):
        self.config = {
            "voiceprint": voiceprint_config or {
                "url": "http://127.0.0.1:8000/voiceprint?key=mock_key",
                "speakers": [
                    "spk_001, Admin, System Administrator (অ্যাডমিন)",
                    "spk_002, RegularUser, Family Member"
                ],
                "similarity_threshold": 0.70,
                "require_voice_match_smart_home": False,
                "admin_speaker_only": False,
                "admin_speakers": ["Admin"]
            }
        }
        self.current_speaker = current_speaker
        self.last_audio_pcm = last_audio_pcm
        self.voiceprint_provider = None
        self.session_id = "test-session-123"


def test_sensitive_tool_blocked_for_unknown_speaker():
    """Test that device_reboot is blocked when speaker is unknown."""
    conn = MockConnection(current_speaker="unknown_speaker")
    allowed, refusal = asyncio.run(
        verify_speaker_security(conn, "device_reboot", {})
    )
    assert not allowed, "Should block unknown speaker from rebooting device"
    assert "ভয়েসপ্রিন্ট যাচাইকরণ ব্যর্থ হয়েছে" in refusal
    assert "Voiceprint verification failed" in refusal


def test_sensitive_tool_allowed_for_admin():
    """Test that device_reboot is allowed when speaker is verified Admin."""
    conn = MockConnection(current_speaker="Admin")
    allowed, refusal = asyncio.run(
        verify_speaker_security(conn, "device_reboot", {})
    )
    assert allowed, "Should allow Admin to reboot device"
    assert refusal is None


def test_admin_speaker_only_blocks_non_admin():
    """Test that Admin Speaker Only policy prevents non-admin registered users from sensitive tools."""
    conn = MockConnection(current_speaker="RegularUser")
    allowed, refusal = asyncio.run(
        verify_speaker_security(conn, "device_reboot", {})
    )
    assert not allowed, "Should block RegularUser from reboot when Admin policy enforced"
    assert "অ্যাডমিন হিসেবে অনুমোদিত নয়" in refusal or "not authorized as Admin" in refusal


def test_smart_home_lock_is_sensitive_action():
    """Test that door unlocking is treated as sensitive and blocked for unverified speakers."""
    conn = MockConnection(current_speaker="unknown_speaker")
    allowed, refusal = asyncio.run(
        verify_speaker_security(conn, "hass_set_state", {
            "domain": "lock",
            "service": "unlock",
            "entity_id": "lock.front_door"
        })
    )
    assert not allowed, "Door unlock must require speaker authentication"
    assert "ভয়েসপ্রিন্ট যাচাইকরণ ব্যর্থ হয়েছে" in refusal


def test_smart_home_require_voice_match():
    """Test that general smart home actions require voice match when flag is True."""
    vp_cfg = {
        "url": "http://127.0.0.1:8000/voiceprint?key=mock_key",
        "speakers": ["spk_001, Admin, Admin", "spk_002, RegularUser, Member"],
        "similarity_threshold": 0.70,
        "require_voice_match_smart_home": True,
        "admin_speaker_only": False,
        "admin_speakers": ["Admin"]
    }
    # 1. Unknown speaker -> blocked
    conn_unknown = MockConnection(voiceprint_config=vp_cfg, current_speaker="unknown_speaker")
    allowed, refusal = asyncio.run(
        verify_speaker_security(conn_unknown, "hass_set_state", {
            "domain": "light",
            "service": "turn_on",
            "entity_id": "light.living_room"
        })
    )
    assert not allowed, "Light switch must be blocked for unknown speaker when require_voice_match is True"

    # 2. Registered RegularUser -> allowed (does not need admin for lights)
    conn_member = MockConnection(voiceprint_config=vp_cfg, current_speaker="RegularUser")
    allowed, refusal = asyncio.run(
        verify_speaker_security(conn_member, "hass_set_state", {
            "domain": "light",
            "service": "turn_on",
            "entity_id": "light.living_room"
        })
    )
    assert allowed, "Registered family member should be allowed to turn on lights"
    assert refusal is None


def test_live_audio_chunk_verification_fallback():
    """Test that live audio chunks are verified when current_speaker is not yet set."""
    conn = MockConnection(current_speaker=None, last_audio_pcm=b"\x00\x01" * 1600)
    mock_provider = MagicMock()
    mock_provider._pcm_to_wav = MagicMock(return_value=b"RIFFmockwav")
    mock_provider.identify_speaker = AsyncMock(return_value="Admin")
    conn.voiceprint_provider = mock_provider

    allowed, refusal = asyncio.run(
        verify_speaker_security(conn, "device_reboot", {})
    )
    assert allowed, "Should dynamically identify Admin from live audio and allow command"
    assert conn.current_speaker == "Admin"
    assert refusal is None
    mock_provider.identify_speaker.assert_awaited_once()


def test_plugin_executor_enforcement():
    """Test that ServerPluginExecutor halts execution when speaker is unauthorized."""
    conn = MockConnection(current_speaker="unknown_speaker")
    executor = ServerPluginExecutor(conn)

    # Calling a sensitive tool should return ActionResponse with refusal message
    response = asyncio.run(
        executor.execute(conn, "device_reboot", {})
    )
    assert isinstance(response, ActionResponse)
    assert "ভয়েসপ্রিন্ট যাচাইকরণ ব্যর্থ হয়েছে" in str(response.response)
    assert "ভয়েসপ্রিন্ট যাচাইকরণ ব্যর্থ হয়েছে" in str(response.result)


if __name__ == "__main__":
    test_sensitive_tool_blocked_for_unknown_speaker()
    print("✓ test_sensitive_tool_blocked_for_unknown_speaker PASSED")
    test_sensitive_tool_allowed_for_admin()
    print("✓ test_sensitive_tool_allowed_for_admin PASSED")
    test_admin_speaker_only_blocks_non_admin()
    print("✓ test_admin_speaker_only_blocks_non_admin PASSED")
    test_smart_home_lock_is_sensitive_action()
    print("✓ test_smart_home_lock_is_sensitive_action PASSED")
    test_smart_home_require_voice_match()
    print("✓ test_smart_home_require_voice_match PASSED")
    test_live_audio_chunk_verification_fallback()
    print("✓ test_live_audio_chunk_verification_fallback PASSED")
    test_plugin_executor_enforcement()
    print("✓ test_plugin_executor_enforcement PASSED")
    print("\nALL 7 VOICEPRINT SECURITY TESTS PASSED!")
