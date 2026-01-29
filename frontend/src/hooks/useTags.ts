import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/tags'

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => api.fetchTags().then((r) => r.data),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  })
}
