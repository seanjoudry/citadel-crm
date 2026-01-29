import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/regions'

export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: () => api.fetchRegions().then((r) => r.data),
  })
}

export function useCreateRegion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createRegion,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['regions'] }),
  })
}
