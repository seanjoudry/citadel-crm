import { apiFetch } from './client'
import type { DashboardData } from '../types'

export function fetchDashboard(): Promise<{ data: DashboardData }> {
  return apiFetch('/api/dashboard')
}
