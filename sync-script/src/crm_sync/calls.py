"""Call history database reader."""

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

# Apple epoch offset (same as messages.py)
APPLE_EPOCH_OFFSET = 978307200


@dataclass
class CallRecord:
    """Call record from CallHistory database."""

    rowid: int
    phone: str
    date: datetime
    duration: int  # seconds
    call_type: int  # 1=incoming, 2=outgoing
    answered: bool


def apple_timestamp_to_datetime(apple_ts: float | None) -> datetime | None:
    """Convert Apple Core Data timestamp to datetime.

    Call history uses seconds (not nanoseconds) since 2001-01-01.

    Args:
        apple_ts: Apple timestamp in seconds

    Returns:
        datetime in UTC, or None if invalid
    """
    if apple_ts is None or apple_ts == 0:
        return None

    try:
        unix_ts = apple_ts + APPLE_EPOCH_OFFSET
        return datetime.fromtimestamp(unix_ts, tz=timezone.utc)
    except (OSError, OverflowError, ValueError):
        return None


def datetime_to_apple_timestamp(dt: datetime | None) -> float:
    """Convert datetime to Apple timestamp for call history.

    Args:
        dt: datetime

    Returns:
        Apple timestamp in seconds
    """
    if dt is None:
        return 0.0

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.timestamp() - APPLE_EPOCH_OFFSET


def get_calls_database_path() -> Path:
    """Get the path to the Call History database.

    Returns:
        Path to CallHistory.storedata
    """
    return Path.home() / "Library/Application Support/CallHistoryDB/CallHistory.storedata"


def open_calls_database() -> sqlite3.Connection:
    """Open the Call History database in immutable mode.

    Returns:
        Database connection
    """
    db_path = get_calls_database_path()
    conn = sqlite3.connect(
        f"file:{db_path}?immutable=1",
        uri=True,
    )
    conn.row_factory = sqlite3.Row
    return conn


def read_calls(
    since_timestamp: float | None = None,
    exclude_rowids: set[int] | None = None,
) -> Iterator[CallRecord]:
    """Read call records from the Call History database.

    Args:
        since_timestamp: Apple timestamp to filter calls after (optional)
        exclude_rowids: Set of ROWIDs to skip (already synced)

    Yields:
        CallRecord for each call
    """
    exclude_rowids = exclude_rowids or set()

    conn = open_calls_database()

    try:
        # Build query with optional timestamp filter
        query = """
            SELECT
                ROWID,
                ZADDRESS,
                ZDATE,
                ZDURATION,
                ZCALLTYPE,
                ZANSWERED
            FROM ZCALLRECORD
            WHERE ZADDRESS IS NOT NULL
        """
        params: list = []

        if since_timestamp:
            query += " AND ZDATE > ?"
            params.append(since_timestamp)

        query += " ORDER BY ZDATE"

        cursor = conn.execute(query, params)

        for row in cursor:
            rowid = row["ROWID"]

            # Skip already synced calls
            if rowid in exclude_rowids:
                continue

            date = apple_timestamp_to_datetime(row["ZDATE"])
            if date is None:
                continue

            yield CallRecord(
                rowid=rowid,
                phone=row["ZADDRESS"],
                date=date,
                duration=int(row["ZDURATION"] or 0),
                call_type=int(row["ZCALLTYPE"] or 0),
                answered=bool(row["ZANSWERED"]),
            )

    finally:
        conn.close()


def check_calls_access() -> bool:
    """Check if we have access to the Call History database.

    This requires Full Disk Access permission.

    Returns:
        True if database exists and is readable
    """
    db_path = get_calls_database_path()

    if not db_path.exists():
        return False

    try:
        conn = open_calls_database()
        conn.execute("SELECT 1 FROM ZCALLRECORD LIMIT 1")
        conn.close()
        return True
    except (sqlite3.Error, PermissionError):
        return False


def get_call_type(call_type: int, answered: bool) -> str:
    """Map call record to interaction type.

    Args:
        call_type: 1=incoming, 2=outgoing
        answered: Whether the call was answered

    Returns:
        Interaction type string
    """
    if not answered:
        return "CALL_MISSED"

    if call_type == 1:
        return "CALL_INBOUND"

    return "CALL_OUTBOUND"
