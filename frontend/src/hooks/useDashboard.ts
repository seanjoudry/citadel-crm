import { useQuery } from '@tanstack/react-query'
import * as api from '../api/dashboard'

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.fetchDashboard().then((r) => r.data),
  })
}
