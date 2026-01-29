import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/interactions'
import { contactKeys } from './useContacts'

export const interactionKeys = {
  all: ['interactions'] as const,
  list: (contactId: number, page: number) => [...interactionKeys.all, contactId, page] as const,
}

export function useInteractions(contactId: number, page = 1) {
  return useQuery({
    queryKey: interactionKeys.list(contactId, page),
    queryFn: () => api.fetchInteractions(contactId, page),
    enabled: contactId > 0,
  })
}

export function useCreateInteraction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: any }) =>
      api.createInteraction(contactId, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: interactionKeys.all })
      qc.invalidateQueries({ queryKey: contactKeys.detail(vars.contactId) })
      qc.invalidateQueries({ queryKey: contactKeys.lists() })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteInteraction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteInteraction,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: interactionKeys.all })
      qc.invalidateQueries({ queryKey: contactKeys.all })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
