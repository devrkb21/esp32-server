"""TinyBot companion: schedules, reminders, prayer times, weather and phone messages for the
robot, plus the mobile web app API (see docs/companion-api.md)."""

from typing import Dict, Optional

_service = None


def get_service(config: Optional[Dict] = None):
    """Process-wide CompanionService (shared by the HTTP server and voice tools).

    Returns None when the companion is disabled or no config was given on first use.
    """
    global _service
    if _service is None and config is not None:
        from core.companion.service import CompanionService
        from core.companion.settings import companion_config

        if not companion_config(config).get("enabled", True):
            return None
        _service = CompanionService(config)
    return _service


def set_service(service) -> None:
    """Install (or clear with None) the shared service; used by tests."""
    global _service
    _service = service
