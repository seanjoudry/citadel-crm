import { apiFetch } from './client'
import type { Region } from '../types'

export function fetchRegions(): Promise<{ data: Region[] }> {
  return apiFetch('/api/regions')
}

export function createRegion(data: { name: string }): Promise<{ data: Region }> {
  return apiFetch('/api/regions', { method: 'POST', body: JSON.stringify(data) })
}
