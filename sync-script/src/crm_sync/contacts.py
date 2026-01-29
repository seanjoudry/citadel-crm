"""macOS Contacts database reader."""

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator


@dataclass
class LocalContact:
    """Contact data from macOS Contacts database."""

    rowid: int
    first_name: str | None
    last_name: str | None
    organization: str | None
    notes: str | None
    phones: list[str]
    emails: list[str]


def find_contacts_database() -> Path | None:
    """Find the macOS Contacts database.

    The database is located at:
    ~/Library/Application Support/AddressBook/Sources/[UUID]/AddressBook-v22.abcddb

    Returns:
        Path to the database file, or None if not found
    """
    base = Path.home() / "Library/Application Support/AddressBook/Sources"

    if not base.exists():
        return None

    # Find any AddressBook database in UUID-named directories
    for db_path in base.glob("*/AddressBook-v22.abcddb"):
        return db_path

    return None


def open_database_safely(db_path: Path) -> sqlite3.Connection:
    """Open database in immutable mode to handle locks.

    macOS apps may have the database locked, so we use immutable mode
    which allows reading even when another process has a write lock.

    Args:
        db_path: Path to the SQLite database

    Returns:
        Database connection
    """
    conn = sqlite3.connect(
        f"file:{db_path}?immutable=1",
        uri=True,
    )
    conn.row_factory = sqlite3.Row
    return conn


def read_contacts(db_path: Path) -> Iterator[LocalContact]:
    """Read all contacts from the macOS Contacts database.

    Args:
        db_path: Path to AddressBook database

    Yields:
        LocalContact for each contact with a name
    """
    conn = open_database_safely(db_path)

    try:
        # First, get all contacts with basic info
        # Note: This is a Core Data SQLite DB, so primary key is Z_PK
        # and ZNOTE is a foreign key to ZABCDNOTE
        cursor = conn.execute("""
            SELECT
                r.Z_PK,
                r.ZFIRSTNAME,
                r.ZLASTNAME,
                r.ZORGANIZATION,
                n.ZTEXT AS ZNOTE
            FROM ZABCDRECORD r
            LEFT JOIN ZABCDNOTE n ON r.ZNOTE = n.Z_PK
            WHERE r.ZFIRSTNAME IS NOT NULL
               OR r.ZLASTNAME IS NOT NULL
               OR r.ZORGANIZATION IS NOT NULL
        """)

        contacts = list(cursor)

        for row in contacts:
            rowid = row["Z_PK"]

            # Get phone numbers for this contact
            phones = _get_phones(conn, rowid)

            # Get emails for this contact
            emails = _get_emails(conn, rowid)

            yield LocalContact(
                rowid=rowid,
                first_name=row["ZFIRSTNAME"],
                last_name=row["ZLASTNAME"],
                organization=row["ZORGANIZATION"],
                notes=row["ZNOTE"],
                phones=phones,
                emails=emails,
            )

    finally:
        conn.close()


def _get_phones(conn: sqlite3.Connection, owner_id: int) -> list[str]:
    """Get all phone numbers for a contact.

    Args:
        conn: Database connection
        owner_id: ROWID of the contact

    Returns:
        List of phone number strings
    """
    cursor = conn.execute(
        """
        SELECT ZFULLNUMBER
        FROM ZABCDPHONENUMBER
        WHERE ZOWNER = ?
        """,
        (owner_id,),
    )

    phones = []
    for row in cursor:
        if row["ZFULLNUMBER"]:
            phones.append(row["ZFULLNUMBER"])

    return phones


def _get_emails(conn: sqlite3.Connection, owner_id: int) -> list[str]:
    """Get all email addresses for a contact.

    Args:
        conn: Database connection
        owner_id: ROWID of the contact

    Returns:
        List of email strings
    """
    cursor = conn.execute(
        """
        SELECT ZADDRESS
        FROM ZABCDEMAILADDRESS
        WHERE ZOWNER = ?
        """,
        (owner_id,),
    )

    emails = []
    for row in cursor:
        if row["ZADDRESS"]:
            emails.append(row["ZADDRESS"].lower())

    return emails


def check_contacts_access() -> bool:
    """Check if we have access to the Contacts database.

    Returns:
        True if database exists and is readable
    """
    db_path = find_contacts_database()
    if not db_path:
        return False

    try:
        conn = open_database_safely(db_path)
        conn.execute("SELECT 1 FROM ZABCDRECORD LIMIT 1")
        conn.close()
        return True
    except (sqlite3.Error, PermissionError):
        return False
