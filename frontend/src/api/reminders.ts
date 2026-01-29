import { apiFetch } from './client'
import type { Reminder } from '../types'

export function fetchReminders(): Promise<{ data: Reminder[] }> {
  return apiFetch('/api/reminders')
}

export function fetchContactReminders(contactId: number): Promise<{ data: Reminder[] }> {
  return apiFetch(`/api/contacts/${contactId}/reminders`)
}

export function createReminder(
  contactId: number,
  data: { remindAt: string; note?: string },
): Promise<{ data: Reminder }> {
  return apiFetch(`/api/contacts/${contactId}/reminders`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateReminder(id: number, data: Partial<Reminder>): Promise<{ data: Reminder }> {
  return apiFetch(`/api/reminders/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteReminder(id: number): Promise<{ data: { deleted: boolean } }> {
  return apiFetch(`/api/reminders/${id}`, { method: 'DELETE' })
}
