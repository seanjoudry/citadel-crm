import { apiFetch } from './client'
import type { Tag } from '../types'

export function fetchTags(): Promise<{ data: Tag[] }> {
  return apiFetch('/api/tags')
}

export function createTag(data: { name: string; color?: string }): Promise<{ data: Tag }> {
  return apiFetch('/api/tags', { method: 'POST', body: JSON.stringify(data) })
}

export function updateTag(id: number, data: Partial<Tag>): Promise<{ data: Tag }> {
  return apiFetch(`/api/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export function deleteTag(id: number): Promise<{ data: { deleted: boolean } }> {
  return apiFetch(`/api/tags/${id}`, { method: 'DELETE' })
}
