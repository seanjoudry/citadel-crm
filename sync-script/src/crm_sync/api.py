"""CRM API client for Citadel CRM."""

from dataclasses import dataclass
from typing import Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


@dataclass
class Contact:
    """Contact data for API operations."""

    id: int | None
    first_name: str
    last_name: str
    phone: str | None = None
    email: str | None = None
    organization: str | None = None
    notes: str | None = None


@dataclass
class Interaction:
    """Interaction data for API operations."""

    contact_id: int
    type: str  # CALL_INBOUND, CALL_OUTBOUND, CALL_MISSED, TEXT_INBOUND, TEXT_OUTBOUND
    occurred_at: str  # ISO 8601 datetime
    content: str | None = None
    duration_seconds: int | None = None
    source: str = "IMPORT_IOS"


class CRMClient:
    """Client for Citadel CRM REST API."""

    def __init__(self, base_url: str, api_key: str = ""):
        """Initialize the CRM client.

        Args:
            base_url: Base URL of the CRM API (e.g., "http://localhost:3001")
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip("/")
        self.session = self._create_session(api_key)

    def _create_session(self, api_key: str) -> requests.Session:
        """Create a requests session with retry logic."""
        session = requests.Session()

        # Configure retries for transient failures
        retry = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "PUT", "DELETE", "OPTIONS", "TRACE", "POST"],
            respect_retry_after_header=True,
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        # Set default headers
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        session.headers.update(headers)
        return session

    def get_contacts(self, page: int = 1, limit: int = 100) -> tuple[list[Contact], int]:
        """Fetch contacts from CRM with pagination.

        Args:
            page: Page number (1-indexed)
            limit: Number of contacts per page (max 100)

        Returns:
            Tuple of (list of contacts, total count)
        """
        response = self.session.get(
            f"{self.base_url}/api/contacts",
            params={"page": page, "limit": limit},
            timeout=(5, 30),
        )
        response.raise_for_status()
        data = response.json()

        contacts = [
            Contact(
                id=c["id"],
                first_name=c["firstName"],
                last_name=c["lastName"],
                phone=c.get("phone"),
                email=c.get("email"),
                organization=c.get("organization"),
                notes=c.get("notes"),
            )
            for c in data["data"]
        ]

        total = data["meta"]["total"]
        return contacts, total

    def get_all_contacts(self) -> list[Contact]:
        """Fetch all contacts from CRM (handles pagination).

        Returns:
            List of all contacts
        """
        all_contacts = []
        page = 1
        limit = 100

        while True:
            contacts, total = self.get_contacts(page=page, limit=limit)
            all_contacts.extend(contacts)

            if len(all_contacts) >= total:
                break

            page += 1

        return all_contacts

    def create_contact(self, contact: Contact) -> Contact:
        """Create a single contact in CRM.

        Args:
            contact: Contact data to create

        Returns:
            Created contact with ID
        """
        payload = {
            "firstName": contact.first_name,
            "lastName": contact.last_name,
        }

        if contact.phone:
            payload["phone"] = contact.phone
        if contact.email:
            payload["email"] = contact.email
        if contact.organization:
            payload["organization"] = contact.organization
        if contact.notes:
            payload["notes"] = contact.notes

        response = self.session.post(
            f"{self.base_url}/api/contacts",
            json=payload,
            timeout=(5, 30),
        )
        response.raise_for_status()
        data = response.json()["data"]

        return Contact(
            id=data["id"],
            first_name=data["firstName"],
            last_name=data["lastName"],
            phone=data.get("phone"),
            email=data.get("email"),
            organization=data.get("organization"),
            notes=data.get("notes"),
        )

    def bulk_import_contacts(self, contacts: list[dict[str, Any]]) -> dict[str, Any]:
        """Bulk import contacts to CRM.

        Args:
            contacts: List of contact dicts with keys: first_name, last_name, phone, email, etc.

        Returns:
            Import result with imported/skipped counts
        """
        # Transform to API format
        payload = [
            {
                "first_name": c.get("first_name"),
                "last_name": c.get("last_name"),
                "phone": c.get("phone"),
                "email": c.get("email"),
                "organization": c.get("organization"),
                "notes": c.get("notes"),
            }
            for c in contacts
        ]

        response = self.session.post(
            f"{self.base_url}/api/import/contacts",
            json=payload,
            timeout=(5, 60),  # Longer timeout for bulk operations
        )
        response.raise_for_status()
        return response.json()["data"]

    def create_interaction(self, interaction: Interaction) -> dict[str, Any]:
        """Create a single interaction for a contact.

        Args:
            interaction: Interaction data

        Returns:
            Created interaction data
        """
        payload = {
            "type": interaction.type,
            "occurredAt": interaction.occurred_at,
            "source": interaction.source,
        }

        if interaction.content:
            payload["content"] = interaction.content
        if interaction.duration_seconds:
            payload["durationSeconds"] = interaction.duration_seconds

        response = self.session.post(
            f"{self.base_url}/api/contacts/{interaction.contact_id}/interactions",
            json=payload,
            timeout=(5, 30),
        )
        response.raise_for_status()
        return response.json()["data"]

    def create_interactions_batch(
        self, interactions: list[Interaction], batch_size: int = 50
    ) -> int:
        """Create multiple interactions in batches.

        Args:
            interactions: List of interactions to create
            batch_size: Number of interactions per batch

        Returns:
            Number of successfully created interactions
        """
        created = 0

        for interaction in interactions:
            try:
                self.create_interaction(interaction)
                created += 1
            except requests.exceptions.HTTPError:
                # Log and continue on individual failures
                pass

        return created

    def close(self) -> None:
        """Close the session."""
        self.session.close()

    def __enter__(self) -> "CRMClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
