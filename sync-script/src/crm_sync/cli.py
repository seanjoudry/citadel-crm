"""CLI entry point for CRM sync."""

import sys
from datetime import datetime, timedelta, timezone

import click

from .api import CRMClient, Contact, Interaction
from .calls import (
    check_calls_access,
    datetime_to_apple_timestamp as calls_dt_to_apple,
    get_call_type,
    read_calls,
)
from .config import Config, SyncState
from .contacts import check_contacts_access, find_contacts_database, read_contacts
from .messages import (
    check_messages_access,
    datetime_to_apple_timestamp as messages_dt_to_apple,
    get_message_type,
    read_messages,
)
from .phone import format_phone_display, normalize_phone, strip_phone_formatting


def log_success(message: str) -> None:
    """Print a success message in green."""
    click.secho(f"  {message}", fg="green")


def log_warning(message: str) -> None:
    """Print a warning message in yellow."""
    click.secho(f"  {message}", fg="yellow")


def log_error(message: str) -> None:
    """Print an error message in red."""
    click.secho(f"  {message}", fg="red", bold=True)


def log_info(message: str) -> None:
    """Print an info message."""
    click.echo(f"  {message}")


@click.command()
@click.option("--contacts-only", is_flag=True, help="Only sync contacts")
@click.option("--interactions-only", is_flag=True, help="Only sync messages and calls")
@click.option("--dry-run", is_flag=True, help="Preview without making changes")
@click.option("--known-only", is_flag=True, help="Skip creating unknown contacts")
@click.option("--days", type=int, help="Limit lookback to N days")
@click.option("--full", is_flag=True, help="Force full resync")
@click.option("-v", "--verbose", is_flag=True, help="Verbose output")
def main(
    contacts_only: bool,
    interactions_only: bool,
    dry_run: bool,
    known_only: bool,
    days: int | None,
    full: bool,
    verbose: bool,
) -> None:
    """Sync macOS contacts and interactions to Citadel CRM."""
    click.secho("\nCitadel CRM Sync", bold=True)
    click.secho("=" * 40)

    # Load configuration
    config = Config.load()
    state = SyncState.load()

    if verbose:
        log_info(f"API URL: {config.api_url}")
        log_info(f"Config: {config}")

    # Clear state if full resync requested
    if full:
        log_warning("Full resync requested - clearing sync state")
        state.clear()

    # Calculate lookback date
    lookback_days = days or config.initial_lookback_days
    lookback_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    if verbose:
        log_info(f"Lookback: {lookback_days} days (since {lookback_date.date()})")

    # Check permissions
    if not _check_permissions(interactions_only):
        sys.exit(1)

    # Initialize API client
    client = CRMClient(config.api_url, config.api_key)

    try:
        # Track statistics
        stats = {
            "contacts_created": 0,
            "contacts_existing": 0,
            "contacts_unknown": 0,
            "messages_synced": 0,
            "calls_synced": 0,
        }

        # Phase 1: Sync contacts
        if not interactions_only:
            _sync_contacts(client, config, state, stats, dry_run, verbose)

        # Phase 2: Sync messages
        if not contacts_only:
            _sync_messages(
                client,
                config,
                state,
                stats,
                lookback_date,
                dry_run,
                known_only,
                verbose,
            )

        # Phase 3: Sync calls
        if not contacts_only:
            _sync_calls(
                client,
                config,
                state,
                stats,
                lookback_date,
                dry_run,
                known_only,
                verbose,
            )

        # Save state
        if not dry_run:
            state.save()

        # Print summary
        click.echo()
        click.secho("Done! Summary:", bold=True)
        log_info(
            f"Contacts: {stats['contacts_created']} created, "
            f"{stats['contacts_existing']} existing, "
            f"{stats['contacts_unknown']} unknown"
        )
        log_info(f"Messages: {stats['messages_synced']} synced")
        log_info(f"Calls: {stats['calls_synced']} synced")

    finally:
        client.close()


def _check_permissions(interactions_only: bool) -> bool:
    """Check required permissions."""
    # Always need messages access for interactions
    if not interactions_only and not check_contacts_access():
        log_warning("Could not access Contacts database")
        log_info("This may be normal if you have no local contacts")

    if not check_messages_access():
        log_error("Cannot access iMessage database")
        log_error("Grant Full Disk Access in:")
        log_error("  System Preferences > Privacy & Security > Full Disk Access")
        return False

    if not check_calls_access():
        log_warning("Cannot access Call History database")
        log_info("Call sync will be skipped")

    return True


def _sync_contacts(
    client: CRMClient,
    config: Config,
    state: SyncState,
    stats: dict,
    dry_run: bool,
    verbose: bool,
) -> None:
    """Phase 1: Sync contacts from macOS to CRM."""
    click.echo()
    click.secho("Phase 1: Syncing contacts...", bold=True)

    # Find contacts database
    db_path = find_contacts_database()
    if not db_path:
        log_warning("No contacts database found")
        return

    # Read local contacts
    local_contacts = list(read_contacts(db_path))
    log_info(f"Found {len(local_contacts)} contacts in macOS Contacts")

    # Fetch existing CRM contacts
    existing_contacts = client.get_all_contacts()
    log_info(f"Found {len(existing_contacts)} contacts in CRM")

    # Build lookup maps from existing contacts
    for contact in existing_contacts:
        if contact.phone:
            normalized = normalize_phone(contact.phone, config.default_region)
            if normalized:
                state.phone_to_contact_id[normalized] = contact.id
            # Also store stripped version for fuzzy matching
            stripped = strip_phone_formatting(contact.phone)
            if stripped:
                state.phone_to_contact_id[stripped] = contact.id

        if contact.email:
            state.email_to_contact_id[contact.email.lower()] = contact.id

    # Find new contacts to create
    new_contacts = []
    for local in local_contacts:
        # Check if any phone or email already exists
        is_duplicate = False

        for phone in local.phones:
            normalized = normalize_phone(phone, config.default_region)
            if normalized and normalized in state.phone_to_contact_id:
                is_duplicate = True
                break
            stripped = strip_phone_formatting(phone)
            if stripped and stripped in state.phone_to_contact_id:
                is_duplicate = True
                break

        if not is_duplicate:
            for email in local.emails:
                if email.lower() in state.email_to_contact_id:
                    is_duplicate = True
                    break

        if is_duplicate:
            stats["contacts_existing"] += 1
            continue

        # Prepare contact for creation
        first_name = local.first_name or ""
        last_name = local.last_name or ""

        # Use organization as last name if no name
        if not first_name and not last_name and local.organization:
            first_name = local.organization

        if not first_name and not last_name:
            continue  # Skip contacts with no name

        # Get primary phone and email
        primary_phone = None
        if local.phones:
            primary_phone = normalize_phone(local.phones[0], config.default_region)
            if not primary_phone:
                primary_phone = local.phones[0]

        primary_email = local.emails[0] if local.emails else None

        new_contacts.append({
            "first_name": first_name,
            "last_name": last_name,
            "phone": primary_phone,
            "email": primary_email,
            "organization": local.organization,
            "notes": local.notes,
        })

    if dry_run:
        log_warning(f"Would create {len(new_contacts)} new contacts (dry run)")
        stats["contacts_created"] = len(new_contacts)
        return

    # Create contacts
    if new_contacts:
        with click.progressbar(new_contacts, label="  Creating contacts") as bar:
            for contact_data in bar:
                try:
                    contact = Contact(
                        id=None,
                        first_name=contact_data["first_name"],
                        last_name=contact_data["last_name"],
                        phone=contact_data.get("phone"),
                        email=contact_data.get("email"),
                        organization=contact_data.get("organization"),
                        notes=contact_data.get("notes"),
                    )
                    created = client.create_contact(contact)
                    stats["contacts_created"] += 1

                    # Update lookup maps
                    if created.phone:
                        normalized = normalize_phone(created.phone, config.default_region)
                        if normalized:
                            state.phone_to_contact_id[normalized] = created.id
                    if created.email:
                        state.email_to_contact_id[created.email.lower()] = created.id

                except Exception as e:
                    if verbose:
                        log_error(f"Failed to create contact: {e}")

    state.last_contacts_sync = datetime.now(timezone.utc)
    log_success(f"Created {stats['contacts_created']} new contacts")


def _sync_messages(
    client: CRMClient,
    config: Config,
    state: SyncState,
    stats: dict,
    lookback_date: datetime,
    dry_run: bool,
    known_only: bool,
    verbose: bool,
) -> None:
    """Phase 2: Sync iMessage interactions."""
    click.echo()
    click.secho("Phase 2: Syncing messages...", bold=True)

    if not check_messages_access():
        log_warning("Skipping messages (no access)")
        return

    # Calculate since timestamp
    since_ts = messages_dt_to_apple(lookback_date)

    # Read messages
    messages = list(
        read_messages(
            since_timestamp=since_ts,
            exclude_guids=state.synced_message_guids,
        )
    )
    log_info(f"Found {len(messages)} messages in lookback period")

    # Match messages to contacts
    matched = []
    unmatched_handles = set()

    for msg in messages:
        contact_id = _find_contact_for_handle(msg.handle, state, config)

        if contact_id:
            matched.append((msg, contact_id))
        else:
            unmatched_handles.add(msg.handle)

    log_info(f"Matched {len(matched)} to known contacts")

    # Handle unknown contacts
    if unmatched_handles and not known_only and config.create_unknown_contacts:
        log_info(f"Creating {len(unmatched_handles)} unknown contacts for unmatched handles")
        if not dry_run:
            for handle in unmatched_handles:
                contact_id = _create_unknown_contact(
                    client, handle, state, config, verbose
                )
                if contact_id:
                    stats["contacts_unknown"] += 1
                    # Re-match messages for this handle
                    for msg in messages:
                        if msg.handle == handle:
                            matched.append((msg, contact_id))

    if dry_run:
        log_warning(f"Would sync {len(matched)} message interactions (dry run)")
        stats["messages_synced"] = len(matched)
        return

    # Create interactions
    if matched:
        with click.progressbar(matched, label="  Syncing messages") as bar:
            for msg, contact_id in bar:
                try:
                    interaction = Interaction(
                        contact_id=contact_id,
                        type=get_message_type(msg.is_from_me),
                        occurred_at=msg.date.isoformat(),
                        content=None,
                        source="IMPORT_IOS",
                    )
                    client.create_interaction(interaction)
                    state.synced_message_guids.add(msg.guid)
                    stats["messages_synced"] += 1
                except Exception as e:
                    if verbose:
                        log_error(f"Failed to create interaction: {e}")

    state.last_messages_sync = datetime.now(timezone.utc)
    log_success(f"Synced {stats['messages_synced']} message interactions")


def _sync_calls(
    client: CRMClient,
    config: Config,
    state: SyncState,
    stats: dict,
    lookback_date: datetime,
    dry_run: bool,
    known_only: bool,
    verbose: bool,
) -> None:
    """Phase 3: Sync call history interactions."""
    click.echo()
    click.secho("Phase 3: Syncing calls...", bold=True)

    if not check_calls_access():
        log_warning("Skipping calls (no access)")
        return

    # Calculate since timestamp
    since_ts = calls_dt_to_apple(lookback_date)

    # Read calls
    calls = list(
        read_calls(
            since_timestamp=since_ts,
            exclude_rowids=state.synced_call_ids,
        )
    )
    log_info(f"Found {len(calls)} calls in lookback period")

    # Match calls to contacts
    matched = []
    unmatched_phones = set()

    for call in calls:
        contact_id = _find_contact_for_phone(call.phone, state, config)

        if contact_id:
            matched.append((call, contact_id))
        else:
            unmatched_phones.add(call.phone)

    log_info(f"Matched {len(matched)} to known contacts")

    # Handle unknown contacts
    if unmatched_phones and not known_only and config.create_unknown_contacts:
        log_info(f"Creating {len(unmatched_phones)} unknown contacts for unmatched phones")
        if not dry_run:
            for phone in unmatched_phones:
                contact_id = _create_unknown_contact(
                    client, phone, state, config, verbose
                )
                if contact_id:
                    stats["contacts_unknown"] += 1
                    # Re-match calls for this phone
                    for call in calls:
                        if call.phone == phone:
                            matched.append((call, contact_id))

    if dry_run:
        log_warning(f"Would sync {len(matched)} call interactions (dry run)")
        stats["calls_synced"] = len(matched)
        return

    # Create interactions
    if matched:
        with click.progressbar(matched, label="  Syncing calls") as bar:
            for call, contact_id in bar:
                try:
                    interaction = Interaction(
                        contact_id=contact_id,
                        type=get_call_type(call.call_type, call.answered),
                        occurred_at=call.date.isoformat(),
                        content=None,
                        duration_seconds=call.duration if call.duration > 0 else None,
                        source="IMPORT_IOS",
                    )
                    client.create_interaction(interaction)
                    state.synced_call_ids.add(call.rowid)
                    stats["calls_synced"] += 1
                except Exception as e:
                    if verbose:
                        log_error(f"Failed to create interaction: {e}")

    state.last_calls_sync = datetime.now(timezone.utc)
    log_success(f"Synced {stats['calls_synced']} call interactions")


def _find_contact_for_handle(
    handle: str, state: SyncState, config: Config
) -> int | None:
    """Find contact ID for a message handle (phone or email).

    Args:
        handle: Phone number or email address
        state: Sync state with lookup maps
        config: Configuration

    Returns:
        Contact ID or None
    """
    # Try as email first
    if "@" in handle:
        return state.email_to_contact_id.get(handle.lower())

    # Try as phone
    return _find_contact_for_phone(handle, state, config)


def _find_contact_for_phone(
    phone: str, state: SyncState, config: Config
) -> int | None:
    """Find contact ID for a phone number.

    Args:
        phone: Phone number
        state: Sync state with lookup maps
        config: Configuration

    Returns:
        Contact ID or None
    """
    # Try normalized
    normalized = normalize_phone(phone, config.default_region)
    if normalized:
        contact_id = state.phone_to_contact_id.get(normalized)
        if contact_id:
            return contact_id

    # Try stripped
    stripped = strip_phone_formatting(phone)
    if stripped:
        contact_id = state.phone_to_contact_id.get(stripped)
        if contact_id:
            return contact_id

    return None


def _create_unknown_contact(
    client: CRMClient,
    handle: str,
    state: SyncState,
    config: Config,
    verbose: bool,
) -> int | None:
    """Create a placeholder contact for an unknown handle.

    Args:
        client: CRM API client
        handle: Phone number or email
        state: Sync state
        config: Configuration
        verbose: Whether to log errors

    Returns:
        Created contact ID or None
    """
    # Determine if phone or email
    is_email = "@" in handle

    if is_email:
        first_name = "Unknown"
        last_name = f"({handle})"
        phone = None
        email = handle
    else:
        display_phone = format_phone_display(
            normalize_phone(handle, config.default_region)
        )
        if not display_phone:
            display_phone = handle
        first_name = "Unknown"
        last_name = f"({display_phone})"
        phone = normalize_phone(handle, config.default_region) or handle
        email = None

    try:
        contact = Contact(
            id=None,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            email=email,
            notes="Auto-created from iOS sync - needs review",
        )
        created = client.create_contact(contact)

        # Update lookup maps
        if created.phone:
            normalized = normalize_phone(created.phone, config.default_region)
            if normalized:
                state.phone_to_contact_id[normalized] = created.id
            stripped = strip_phone_formatting(created.phone)
            if stripped:
                state.phone_to_contact_id[stripped] = created.id

        if created.email:
            state.email_to_contact_id[created.email.lower()] = created.id

        return created.id

    except Exception as e:
        if verbose:
            log_error(f"Failed to create unknown contact for {handle}: {e}")
        return None


if __name__ == "__main__":
    main()
