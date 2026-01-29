import { apiFetch } from './client'
import type { Contact, ContactFilters, PaginatedResponse } from '../types'

export function fetchContacts(filters: ContactFilters): Promise<PaginatedResponse<Contact>> {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.tagIds?.length) params.set('tagIds', filters.tagIds.join(','))
  if (filters.groupId) params.set('groupId', String(filters.groupId))
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.needsAttention) params.set('needsAttention', 'true')
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))

  return apiFetch(`/api/contacts?${params}`)
}

export function fetchContact(id: number): Promise<{ data: Contact }> {
  return apiFetch(`/api/contacts/${id}`)
}

export function createContact(data: Partial<Contact>): Promise<{ data: Contact }> {
  return apiFetch('/api/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateContact(id: number, data: Partial<Contact>): Promise<{ data: Contact }> {
  return apiFetch(`/api/contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteContact(id: number): Promise<{ data: { deleted: boolean } }> {
  return apiFetch(`/api/contacts/${id}`, { method: 'DELETE' })
}

export function assignTag(contactId: number, tagId: number): Promise<any> {
  return apiFetch(`/api/contacts/${contactId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tagId }),
  })
}

export function removeTag(contactId: number, tagId: number): Promise<any> {
  return apiFetch(`/api/contacts/${contactId}/tags/${tagId}`, { method: 'DELETE' })
}

export function assignGroup(contactId: number, groupId: number): Promise<any> {
  return apiFetch(`/api/contacts/${contactId}/groups`, {
    method: 'POST',
    body: JSON.stringify({ groupId }),
  })
}

export function removeGroup(contactId: number, groupId: number): Promise<any> {
  return apiFetch(`/api/contacts/${contactId}/groups/${groupId}`, { method: 'DELETE' })
}
