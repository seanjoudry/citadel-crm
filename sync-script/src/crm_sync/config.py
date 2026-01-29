"""Configuration and state management for CRM sync."""

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CONFIG_PATH = Path.home() / ".crm-sync-config.json"
STATE_PATH = Path.home() / ".crm-sync-state.json"

DEFAULT_CONFIG = {
    "api_url": "http://localhost:3001",
    "api_key": "",
    "initial_lookback_days": 365,
    "create_unknown_contacts": True,
    "default_region": "US",
}


@dataclass
class Config:
    """Sync configuration loaded from ~/.crm-sync-config.json."""

    api_url: str
    api_key: str
    initial_lookback_days: int
    create_unknown_contacts: bool
    default_region: str

    @classmethod
    def load(cls) -> "Config":
        """Load config from file, creating default if missing."""
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH) as f:
                data = json.load(f)
        else:
            data = DEFAULT_CONFIG.copy()
            CONFIG_PATH.write_text(json.dumps(data, indent=2))

        return cls(
            api_url=data.get("api_url", DEFAULT_CONFIG["api_url"]).rstrip("/"),
            api_key=data.get("api_key", ""),
            initial_lookback_days=data.get(
                "initial_lookback_days", DEFAULT_CONFIG["initial_lookback_days"]
            ),
            create_unknown_contacts=data.get(
                "create_unknown_contacts", DEFAULT_CONFIG["create_unknown_contacts"]
            ),
            default_region=data.get("default_region", DEFAULT_CONFIG["default_region"]),
        )


@dataclass
class SyncState:
    """Sync state stored in ~/.crm-sync-state.json."""

    last_contacts_sync: datetime | None = None
    last_messages_sync: datetime | None = None
    last_calls_sync: datetime | None = None
    synced_message_guids: set[str] = field(default_factory=set)
    synced_call_ids: set[int] = field(default_factory=set)
    phone_to_contact_id: dict[str, int] = field(default_factory=dict)
    email_to_contact_id: dict[str, int] = field(default_factory=dict)

    @classmethod
    def load(cls) -> "SyncState":
        """Load state from file, returning empty state if missing."""
        if not STATE_PATH.exists():
            return cls()

        with open(STATE_PATH) as f:
            data = json.load(f)

        return cls(
            last_contacts_sync=_parse_datetime(data.get("last_contacts_sync")),
            last_messages_sync=_parse_datetime(data.get("last_messages_sync")),
            last_calls_sync=_parse_datetime(data.get("last_calls_sync")),
            synced_message_guids=set(data.get("synced_message_guids", [])),
            synced_call_ids=set(data.get("synced_call_ids", [])),
            phone_to_contact_id=data.get("phone_to_contact_id", {}),
            email_to_contact_id=data.get("email_to_contact_id", {}),
        )

    def save(self) -> None:
        """Save state to file."""
        data = {
            "last_contacts_sync": _format_datetime(self.last_contacts_sync),
            "last_messages_sync": _format_datetime(self.last_messages_sync),
            "last_calls_sync": _format_datetime(self.last_calls_sync),
            "synced_message_guids": list(self.synced_message_guids),
            "synced_call_ids": list(self.synced_call_ids),
            "phone_to_contact_id": self.phone_to_contact_id,
            "email_to_contact_id": self.email_to_contact_id,
        }
        STATE_PATH.write_text(json.dumps(data, indent=2))

    def clear(self) -> None:
        """Clear all sync state for full resync."""
        self.last_contacts_sync = None
        self.last_messages_sync = None
        self.last_calls_sync = None
        self.synced_message_guids.clear()
        self.synced_call_ids.clear()
        # Keep contact mappings - they're still valid


def _parse_datetime(value: str | None) -> datetime | None:
    """Parse ISO datetime string."""
    if value is None:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _format_datetime(value: datetime | None) -> str | None:
    """Format datetime to ISO string."""
    if value is None:
        return None
    return value.isoformat()
