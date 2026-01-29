import { apiFetch } from './client'
import type { Interaction, PaginatedResponse } from '../types'

export function fetchInteractions(
  contactId: number,
  page = 1,
  limit = 20,
): Promise<PaginatedResponse<Interaction>> {
  return apiFetch(`/api/contacts/${contactId}/interactions?page=${page}&limit=${limit}`)
}

export function createInteraction(
  contactId: number,
  data: { type: string; content?: string; durationSeconds?: number; occurredAt: string; source?: string },
): Promise<{ data: Interaction }> {
  return apiFetch(`/api/contacts/${contactId}/interactions`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateInteraction(id: number, data: Partial<Interaction>): Promise<{ data: Interaction }> {
  return apiFetch(`/api/interactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteInteraction(id: number): Promise<{ data: { deleted: boolean } }> {
  return apiFetch(`/api/interactions/${id}`, { method: 'DELETE' })
}
