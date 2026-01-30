"""iMessage database reader."""

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

# Apple epoch: 2001-01-01 00:00:00 UTC
# Difference from Unix epoch (1970-01-01) in seconds
APPLE_EPOCH_OFFSET = 978307200


@dataclass
class Message:
    """Message data from iMessage database."""

    rowid: int
    guid: str
    date: datetime
    is_from_me: bool
    handle: str  # Phone number or email


def apple_timestamp_to_datetime(apple_ts: int | None) -> datetime | None:
    """Convert Apple Core Data timestamp to datetime.

    Apple timestamps are nanoseconds since 2001-01-01 00:00:00 UTC.

    Args:
        apple_ts: Apple timestamp in nanoseconds

    Returns:
        datetime in UTC, or None if invalid
    """
    if apple_ts is None or apple_ts == 0:
        return None

    try:
        # Convert nanoseconds to seconds and add Apple epoch offset
        unix_ts = (apple_ts / 1_000_000_000) + APPLE_EPOCH_OFFSET
        return datetime.fromtimestamp(unix_ts, tz=timezone.utc)
    except (OSError, OverflowError, ValueError):
        return None


def datetime_to_apple_timestamp(dt: datetime | None) -> int:
    """Convert datetime to Apple Core Data timestamp.

    Args:
        dt: datetime (will be converted to UTC if needed)

    Returns:
        Apple timestamp in nanoseconds
    """
    if dt is None:
        return 0

    # Ensure we have UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    unix_ts = dt.timestamp()
    apple_ts = (unix_ts - APPLE_EPOCH_OFFSET) * 1_000_000_000
    return int(apple_ts)


def get_messages_database_path() -> Path:
    """Get the path to the iMessage database.

    Returns:
        Path to chat.db
    """
    return Path.home() / "Library/Messages/chat.db"


def open_messages_database() -> sqlite3.Connection:
    """Open the iMessage database in immutable mode.

    Returns:
        Database connection
    """
    db_path = get_messages_database_path()
    conn = sqlite3.connect(
        f"file:{db_path}?immutable=1",
        uri=True,
    )
    conn.row_factory = sqlite3.Row
    return conn


def read_messages(
    since_timestamp: int | None = None,
    exclude_guids: set[str] | None = None,
) -> Iterator[Message]:
    """Read messages from the iMessage database.

    Args:
        since_timestamp: Apple timestamp to filter messages after (optional)
        exclude_guids: Set of message GUIDs to skip (already synced)

    Yields:
        Message for each message record
    """
    exclude_guids = exclude_guids or set()

    conn = open_messages_database()

    try:
        # Build query with optional timestamp filter
        query = """
            SELECT
                m.ROWID,
                m.guid,
                m.date,
                m.is_from_me,
                h.id as handle
            FROM message m
            JOIN handle h ON m.handle_id = h.ROWID
            WHERE h.id IS NOT NULL
        """
        params: list = []

        if since_timestamp:
            query += " AND m.date > ?"
            params.append(since_timestamp)

        query += " ORDER BY m.date"

        cursor = conn.execute(query, params)

        for row in cursor:
            guid = row["guid"]

            # Skip already synced messages
            if guid in exclude_guids:
                continue

            date = apple_timestamp_to_datetime(row["date"])
            if date is None:
                continue

            yield Message(
                rowid=row["ROWID"],
                guid=guid,
                date=date,
                is_from_me=bool(row["is_from_me"]),
                handle=row["handle"],
            )

    finally:
        conn.close()


def check_messages_access() -> bool:
    """Check if we have access to the iMessage database.

    This requires Full Disk Access permission.

    Returns:
        True if database exists and is readable
    """
    db_path = get_messages_database_path()

    if not db_path.exists():
        return False

    try:
        conn = open_messages_database()
        conn.execute("SELECT 1 FROM message LIMIT 1")
        conn.close()
        return True
    except (sqlite3.Error, PermissionError):
        return False


def get_message_type(is_from_me: bool) -> str:
    """Get the interaction type for a message.

    Args:
        is_from_me: Whether the message was sent by the user

    Returns:
        Interaction type string
    """
    return "TEXT_OUTBOUND" if is_from_me else "TEXT_INBOUND"
