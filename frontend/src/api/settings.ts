import { apiFetch } from './client'

export function fetchSettings(): Promise<{ data: Record<string, string> }> {
  return apiFetch('/api/settings')
}

export function updateSetting(key: string, value: string): Promise<any> {
  return apiFetch(`/api/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
}
