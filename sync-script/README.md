# Citadel CRM Sync

Sync macOS contacts, iMessages, and call history to Citadel CRM.

## Installation

```bash
cd sync-script
pip install -e .
```

Or install dependencies directly:

```bash
pip install click requests phonenumbers
```

## Requirements

- Python 3.11+
- macOS (for access to system databases)
- **Full Disk Access** permission for Terminal/iTerm

### Granting Full Disk Access

1. Open **System Preferences** > **Privacy & Security** > **Full Disk Access**
2. Click the lock to make changes
3. Add your terminal app (Terminal.app or iTerm)
4. Restart your terminal

## Configuration

Create `~/.crm-sync-config.json`:

```json
{
  "api_url": "https://your-crm.up.railway.app",
  "api_key": "",
  "initial_lookback_days": 365,
  "create_unknown_contacts": true,
  "default_region": "US"
}
```

| Option | Description | Default |
|--------|-------------|---------|
| `api_url` | CRM backend URL | `http://localhost:3001` |
| `api_key` | API key (if auth enabled) | `""` |
| `initial_lookback_days` | Days of history to sync | `365` |
| `create_unknown_contacts` | Create contacts for unknown numbers | `true` |
| `default_region` | Default phone number region | `"US"` |

## Usage

```bash
# Full sync - contacts, messages, and calls
crm-sync

# Or run as module
python -m crm_sync
```

### Options

| Flag | Description |
|------|-------------|
| `--contacts-only` | Only sync contacts |
| `--interactions-only` | Only sync messages and calls (skip contacts) |
| `--dry-run` | Preview changes without syncing |
| `--known-only` | Skip creating contacts for unknown numbers |
| `--days N` | Limit lookback to N days |
| `--full` | Force full resync (clear sync state) |
| `-v, --verbose` | Verbose output |

### Examples

```bash
# Preview what would be synced
crm-sync --dry-run

# Sync only last 30 days
crm-sync --days 30

# Skip unknown contact creation
crm-sync --known-only

# Force resync everything
crm-sync --full

# Verbose output
crm-sync -v
```

## What Gets Synced

### Contacts

- First name, last name, organization
- Phone numbers (normalized to E.164 format)
- Email addresses
- Notes

### Messages (iMessage)

- Timestamp and direction only
- **No message content is synced**
- Creates `TEXT_INBOUND` or `TEXT_OUTBOUND` interactions

### Calls

- Timestamp, duration, direction
- Creates `CALL_INBOUND`, `CALL_OUTBOUND`, or `CALL_MISSED` interactions

## Sync State

State is stored in `~/.crm-sync-state.json`:

- Last sync timestamps
- Synced message GUIDs (to avoid duplicates)
- Synced call IDs (to avoid duplicates)
- Phone/email to contact ID mappings

Delete this file to force a full resync, or use `--full`.

## Database Locations

| Database | Path |
|----------|------|
| Contacts | `~/Library/Application Support/AddressBook/Sources/[UUID]/AddressBook-v22.abcddb` |
| Messages | `~/Library/Messages/chat.db` |
| Calls | `~/Library/Application Support/CallHistoryDB/CallHistory.storedata` |

## Troubleshooting

### "Cannot access iMessage database"

Grant Full Disk Access permission to your terminal app.

### "No contacts database found"

You may not have any local contacts. iCloud contacts are synced elsewhere.

### Phone numbers not matching

The script normalizes phone numbers to E.164 format (+19025551234). Ensure your CRM contacts also use normalized formats.

## Privacy

- **Read-only**: The script never writes to Apple databases
- **No message content**: Only timestamps are synced
- **Local only**: Runs entirely on your machine
