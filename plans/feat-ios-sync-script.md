# feat: iOS Sync Script (Contacts, iMessages, Calls)

Build a Python script that runs locally on macOS to sync contacts, iMessage history, and call history metadata to Citadel CRM.

## Overview

A standalone Python CLI tool that reads from macOS system databases (Contacts, Messages, Call History) and syncs data to the Citadel CRM backend via its existing REST API. The script handles contact deduplication, phone number normalization, incremental sync state, and creation of placeholder contacts for unknown numbers.

## Problem Statement

Manual contact and interaction tracking is tedious. macOS already has rich data about who you communicate with and when. This script bridges the gap by automatically importing:
- Contacts from macOS Contacts app
- Message timestamps (not content) from iMessage
- Call metadata from Phone/FaceTime

## Technical Approach

### Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│  macOS Databases    │     │   Citadel CRM API   │
├─────────────────────┤     ├─────────────────────┤
│ AddressBook.abcddb  │────▶│ POST /api/contacts  │
│ chat.db (iMessage)  │────▶│ POST /api/import/*  │
│ CallHistory.store   │────▶│                     │
└─────────────────────┘     └─────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│   Python Script     │     │   ~/.crm-sync-*     │
│   (click CLI)       │────▶│   state & config    │
└─────────────────────┘     └─────────────────────┘
```

### Database Locations

| Database | Path | Key Tables |
|----------|------|------------|
| Contacts | `~/Library/Application Support/AddressBook/Sources/[UUID]/AddressBook-v22.abcddb` | ZABCDRECORD, ZABCDPHONENUMBER, ZABCDEMAILADDRESS |
| iMessage | `~/Library/Messages/chat.db` | message, handle, chat_message_join |
| Calls | `~/Library/Application Support/CallHistoryDB/CallHistory.storedata` | ZCALLRECORD |

### Existing CRM API Endpoints

The CRM already has these endpoints (no new backend work needed):

```
GET  /api/contacts              # List contacts (paginated, searchable)
POST /api/contacts              # Create single contact
POST /api/import/contacts       # Bulk import contacts
POST /api/contacts/:id/interactions  # Create interaction
POST /api/import/interactions   # Bulk import interactions (matches by email)
```

**Interaction Types Available:** `CALL_INBOUND`, `CALL_OUTBOUND`, `CALL_MISSED`, `TEXT_INBOUND`, `TEXT_OUTBOUND`

**Interaction Source:** `IMPORT_IOS` (already defined in schema)

---

## Implementation Phases

### Phase 1: Project Setup & Contact Sync

**Goal:** Read macOS contacts and sync to CRM with deduplication.

#### Tasks

- [x] Create project structure with `pyproject.toml`
- [x] Implement config file loading (`~/.crm-sync-config.json`)
- [x] Implement state file management (`~/.crm-sync-state.json`)
- [x] Find contacts database dynamically (handle UUID directory)
- [x] Read contacts with phone numbers and emails (JOIN queries)
- [x] Normalize phone numbers to E.164 format
- [x] Fetch existing CRM contacts for deduplication
- [x] Build phone/email → contact_id lookup map
- [x] Create new contacts via bulk import endpoint
- [x] Add `--contacts-only` and `--dry-run` flags

#### Files

```
sync-script/
├── pyproject.toml
├── README.md
└── src/
    └── crm_sync/
        ├── __init__.py
        ├── cli.py           # Click CLI entry point
        ├── config.py        # Config & state management
        ├── api.py           # CRM API client
        ├── phone.py         # Phone normalization
        └── contacts.py      # macOS contacts reader
```

#### Contact Database Query

```sql
SELECT
    r.ROWID,
    r.ZFIRSTNAME,
    r.ZLASTNAME,
    r.ZORGANIZATION,
    r.ZNOTE,
    GROUP_CONCAT(DISTINCT p.ZFULLNUMBER) as phones,
    GROUP_CONCAT(DISTINCT e.ZADDRESS) as emails
FROM ZABCDRECORD r
LEFT JOIN ZABCDPHONENUMBER p ON p.ZOWNER = r.ROWID
LEFT JOIN ZABCDEMAILADDRESS e ON e.ZOWNER = r.ROWID
WHERE r.ZFIRSTNAME IS NOT NULL OR r.ZLASTNAME IS NOT NULL
GROUP BY r.ROWID
```

#### Contact Payload

```json
{
  "firstName": "Christine",
  "lastName": "Baker",
  "phone": "+19025551234",
  "email": "christine@example.com",
  "organization": "Acme Corp",
  "notes": "Imported from macOS Contacts"
}
```

---

### Phase 2: iMessage Sync

**Goal:** Create interaction records for all iMessage timestamps.

#### Tasks

- [x] Read iMessage database (handle locked DB with immutable mode)
- [x] Convert Apple Core Data timestamps to ISO 8601
- [x] Extract handle (phone/email) and direction (is_from_me)
- [x] Match handles to contact_id using lookup map from Phase 1
- [x] Track synced message GUIDs to avoid duplicates
- [x] Batch create interactions via API
- [x] Add `--interactions-only` flag

#### iMessage Database Query

```sql
SELECT
    m.ROWID,
    m.guid,
    m.date,
    m.is_from_me,
    h.id as handle
FROM message m
JOIN handle h ON m.handle_id = h.ROWID
WHERE m.date > ?  -- Filter by last sync timestamp
ORDER BY m.date
```

#### Apple Timestamp Conversion

```python
def apple_timestamp_to_datetime(apple_ts: int) -> datetime:
    """Convert Apple Core Data timestamp to datetime.

    Apple timestamps are nanoseconds since 2001-01-01.
    """
    APPLE_EPOCH = 978307200  # Seconds between 1970 and 2001
    unix_ts = (apple_ts / 1_000_000_000) + APPLE_EPOCH
    return datetime.fromtimestamp(unix_ts, tz=timezone.utc)
```

#### Interaction Payload

```json
{
  "contactId": 123,
  "type": "TEXT_OUTBOUND",
  "content": null,
  "occurredAt": "2025-01-15T14:32:00Z",
  "source": "IMPORT_IOS"
}
```

---

### Phase 3: Call History Sync

**Goal:** Create interaction records for all phone calls.

#### Tasks

- [x] Read call history database
- [x] Extract phone number, timestamp, duration, call type
- [x] Map call types: 1=inbound, 2=outbound, unanswered=missed
- [x] Match phone numbers to contact_id
- [x] Track synced call ROWIDs
- [x] Batch create interactions with duration

#### Call History Query

```sql
SELECT
    ROWID,
    ZADDRESS as phone,
    ZDATE as timestamp,
    ZDURATION as duration,
    ZCALLTYPE as call_type,
    ZANSWERED as answered
FROM ZCALLRECORD
WHERE ZDATE > ?
ORDER BY ZDATE
```

#### Call Type Mapping

```python
def map_call_type(call_type: int, answered: bool) -> str:
    if not answered:
        return "CALL_MISSED"
    return "CALL_INBOUND" if call_type == 1 else "CALL_OUTBOUND"
```

#### Interaction Payload (with duration)

```json
{
  "contactId": 123,
  "type": "CALL_OUTBOUND",
  "content": null,
  "durationSeconds": 145,
  "occurredAt": "2025-01-15T14:32:00Z",
  "source": "IMPORT_IOS"
}
```

---

### Phase 4: Unknown Number Handling

**Goal:** Create placeholder contacts for unmatched phone numbers.

#### Tasks

- [x] Collect all unmatched phone numbers from messages and calls
- [x] Create contacts with name "Unknown (+1-905-555-1234)"
- [x] Add to lookup map for future interactions
- [x] Log unknown contacts separately for review
- [x] Add `--known-only` flag to skip this

#### Unknown Contact Payload

```json
{
  "firstName": "Unknown",
  "lastName": "(+1-905-555-1234)",
  "phone": "+19055551234",
  "notes": "Auto-created from iOS sync - needs review"
}
```

---

## Configuration

### Config File (`~/.crm-sync-config.json`)

```json
{
  "api_url": "https://citadel-crm.up.railway.app",
  "api_key": "",
  "initial_lookback_days": 365,
  "create_unknown_contacts": true,
  "default_region": "US"
}
```

### State File (`~/.crm-sync-state.json`)

```json
{
  "last_contacts_sync": "2025-01-29T12:00:00Z",
  "last_messages_sync": "2025-01-29T12:00:00Z",
  "last_calls_sync": "2025-01-29T12:00:00Z",
  "synced_message_guids": ["abc123", "def456"],
  "synced_call_ids": [1, 2, 3],
  "phone_to_contact_id": {
    "+19025551234": 42
  }
}
```

---

## CLI Interface

```bash
# Full sync - contacts, then messages, then calls
python -m crm_sync

# Contacts only
python -m crm_sync --contacts-only

# Messages and calls only (assumes contacts synced)
python -m crm_sync --interactions-only

# Dry run - preview changes
python -m crm_sync --dry-run

# Skip unknown contact creation
python -m crm_sync --known-only

# Limit lookback period
python -m crm_sync --days 30

# Force full resync
python -m crm_sync --full

# Verbose output
python -m crm_sync -v
```

### CLI Implementation

```python
@click.command()
@click.option('--contacts-only', is_flag=True, help='Only sync contacts')
@click.option('--interactions-only', is_flag=True, help='Only sync messages and calls')
@click.option('--dry-run', is_flag=True, help='Preview without making changes')
@click.option('--known-only', is_flag=True, help='Skip creating unknown contacts')
@click.option('--days', type=int, help='Limit lookback to N days')
@click.option('--full', is_flag=True, help='Force full resync')
@click.option('-v', '--verbose', is_flag=True, help='Verbose output')
def sync(contacts_only, interactions_only, dry_run, known_only, days, full, verbose):
    """Sync macOS contacts and interactions to Citadel CRM."""
    pass
```

---

## Dependencies

### requirements.txt

```
click>=8.0
requests>=2.28
phonenumbers>=8.13
```

### pyproject.toml

```toml
[project]
name = "crm-sync"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "click>=8.0",
    "requests>=2.28",
    "phonenumbers>=8.13",
]

[project.scripts]
crm-sync = "crm_sync.cli:sync"
```

---

## Acceptance Criteria

### Functional Requirements

- [ ] Reads contacts from macOS Contacts database
- [ ] Normalizes phone numbers to E.164 format
- [ ] Deduplicates contacts by phone/email match
- [ ] Creates new contacts in CRM
- [ ] Reads iMessage timestamps (not content)
- [ ] Reads call history with duration
- [ ] Creates interaction records with correct type
- [ ] Uses `IMPORT_IOS` as source
- [ ] Tracks sync state to avoid duplicates
- [ ] Creates placeholder contacts for unknown numbers
- [ ] All CLI flags work as documented

### Non-Functional Requirements

- [ ] Handles locked databases gracefully (immutable mode)
- [ ] Shows progress bars for long operations
- [ ] Colored output for success/warning/error
- [ ] Graceful error messages for missing permissions
- [ ] No writes to Apple databases (read-only)

### Quality Gates

- [ ] Works with Full Disk Access permission
- [ ] Handles missing databases gracefully
- [ ] Idempotent - running twice produces same result

---

## Error Handling

### Permission Denied

```python
def check_full_disk_access() -> bool:
    """Check if we have Full Disk Access."""
    test_path = Path.home() / "Library/Messages/chat.db"
    try:
        test_path.stat()
        return True
    except PermissionError:
        return False

if not check_full_disk_access():
    click.secho(
        "Full Disk Access required. Grant permission in:\n"
        "System Preferences → Privacy & Security → Full Disk Access",
        fg="red"
    )
    sys.exit(1)
```

### Database Locked

```python
def open_database_safely(db_path: Path) -> sqlite3.Connection:
    """Open database in immutable mode to handle locks."""
    return sqlite3.connect(
        f"file:{db_path}?immutable=1",
        uri=True
    )
```

---

## Output Example

```
Citadel CRM Sync
================

Phase 1: Syncing contacts...
  Found 342 contacts in macOS Contacts
  187 already exist in CRM (matched by phone/email)
  ✓ Created 155 new contacts

Phase 2: Syncing messages...
  Found 12,456 messages in lookback period
  Matched 11,203 to known contacts
  Created 45 unknown contacts for unmatched numbers
  ✓ Synced 11,248 message interactions

Phase 3: Syncing calls...
  Found 234 calls in lookback period
  ✓ Synced 198 call interactions
  Skipped 36 calls (no matching contact)

Done! Summary:
  Contacts: 155 created, 187 existing, 45 unknown
  Messages: 11,248 synced
  Calls: 198 synced
```

---

## Important Notes

1. **Full Disk Access** - Terminal needs permission in System Preferences
2. **Read-Only** - Script never writes to Apple databases
3. **No Message Content** - Only timestamps are synced, not actual messages
4. **Database Locking** - Uses `?immutable=1` to read locked DBs
5. **UUID Paths** - Contacts DB path has machine-specific UUID
6. **No Auth Required** - CRM API currently has no authentication

---

## References

### Internal Files
- `backend/src/routes/contacts.ts` - Contacts API
- `backend/src/routes/interactions.ts` - Interactions API
- `backend/src/routes/import.ts` - Bulk import endpoints
- `backend/prisma/schema.prisma` - Database schema

### External Documentation
- [phonenumbers library](https://daviddrysdale.github.io/python-phonenumbers/)
- [click CLI framework](https://click.palletsprojects.com/)
- [Python sqlite3 URI mode](https://docs.python.org/3/library/sqlite3.html)
- [Apple Core Data timestamps](https://developer.apple.com/documentation/foundation/date)
