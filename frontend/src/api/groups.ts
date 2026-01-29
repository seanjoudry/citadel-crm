import { apiFetch } from './client'
import type { Group } from '../types'

export function fetchGroups(): Promise<{ data: Group[] }> {
  return apiFetch('/api/groups')
}

export function createGroup(data: { name: string; description?: string }): Promise<{ data: Group }> {
  return apiFetch('/api/groups', { method: 'POST', body: JSON.stringify(data) })
}

export function updateGroup(id: number, data: Partial<Group>): Promise<{ data: Group }> {
  return apiFetch(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteGroup(id: number): Promise<{ data: { deleted: boolean } }> {
  return apiFetch(`/api/groups/${id}`, { method: 'DELETE' })
}
