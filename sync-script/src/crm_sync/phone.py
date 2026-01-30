"""Phone number normalization using phonenumbers library."""

import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberFormat


def normalize_phone(raw: str | None, default_region: str = "US") -> str | None:
    """Normalize a phone number to E.164 format.

    Args:
        raw: Raw phone number string (e.g., "(902) 555-1234", "+1-902-555-1234")
        default_region: Default region code for numbers without country code

    Returns:
        E.164 formatted number (e.g., "+19025551234") or None if invalid
    """
    if not raw:
        return None

    # Clean up common formatting issues
    cleaned = raw.strip()
    if not cleaned:
        return None

    try:
        parsed = phonenumbers.parse(cleaned, default_region)

        if not phonenumbers.is_valid_number(parsed):
            # Try parsing as-is if validation fails (some numbers may be valid but unusual)
            if not phonenumbers.is_possible_number(parsed):
                return None

        return phonenumbers.format_number(parsed, PhoneNumberFormat.E164)

    except NumberParseException:
        return None


def format_phone_display(e164: str | None) -> str:
    """Format E.164 number for display (e.g., +1-902-555-1234).

    Args:
        e164: E.164 formatted number

    Returns:
        Human-readable formatted number
    """
    if not e164:
        return ""

    try:
        parsed = phonenumbers.parse(e164, None)
        return phonenumbers.format_number(parsed, PhoneNumberFormat.INTERNATIONAL)
    except NumberParseException:
        return e164


def strip_phone_formatting(raw: str | None) -> str | None:
    """Strip all formatting from a phone number, keeping only digits and +.

    Useful for comparison when E.164 normalization fails.

    Args:
        raw: Raw phone number string

    Returns:
        Digits only (with optional leading +), or None if empty
    """
    if not raw:
        return None

    # Keep only digits and leading +
    cleaned = "".join(c for c in raw if c.isdigit() or c == "+")
    if not cleaned or cleaned == "+":
        return None

    return cleaned
