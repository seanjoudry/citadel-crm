import { apiFetch } from './client'
import type { Interaction, PaginatedResponse } from '../types'

export function fetchInteractions(
  contactId: number,
  page = 1,
  limit = 20,
  date?: string | null,
): Promise<PaginatedResponse<Interaction>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (date) params.set('date', date)
  return apiFetch(`/api/contacts/${contactId}/interactions?${params}`)
}

export interface HeatmapData {
  date: string
  count: number
}

export interface HeatmapResponse {
  data: HeatmapData[]
  meta: {
    totalInteractions: number
    activeDays: number
    startDate: string
    endDate: string
  }
}

export function fetchActivityHeatmap(contactId: number): Promise<HeatmapResponse> {
  return apiFetch(`/api/contacts/${contactId}/activity-heatmap`)
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
