import { apiFetch } from './client'
import type { NotableDate } from '../types'

export function fetchUpcomingDates(days = 14): Promise<{ data: NotableDate[] }> {
  return apiFetch(`/api/notable-dates/upcoming?days=${days}`)
}

export function fetchContactNotableDates(contactId: number): Promise<{ data: NotableDate[] }> {
  return apiFetch(`/api/contacts/${contactId}/notable-dates`)
}

export function createNotableDate(
  contactId: number,
  data: Partial<NotableDate>,
): Promise<{ data: NotableDate }> {
  return apiFetch(`/api/contacts/${contactId}/notable-dates`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateNotableDate(id: number, data: Partial<NotableDate>): Promise<{ data: NotableDate }> {
  return apiFetch(`/api/notable-dates/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteNotableDate(id: number): Promise<{ data: { deleted: boolean } }> {
  return apiFetch(`/api/notable-dates/${id}`, { method: 'DELETE' })
}
