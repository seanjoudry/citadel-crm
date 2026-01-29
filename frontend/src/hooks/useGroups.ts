import { useQuery } from '@tanstack/react-query'
import * as api from '../api/groups'

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => api.fetchGroups().then((r) => r.data),
  })
}
