import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/interactions'
import { contactKeys } from './useContacts'

export const interactionKeys = {
  all: ['interactions'] as const,
  list: (contactId: number, page: number, date?: string | null) =>
    [...interactionKeys.all, contactId, page, date ?? 'all'] as const,
  heatmap: (contactId: number) => [...interactionKeys.all, 'heatmap', contactId] as const,
}

export function useInteractions(contactId: number, page = 1, date?: string | null) {
  return useQuery({
    queryKey: interactionKeys.list(contactId, page, date),
    queryFn: () => api.fetchInteractions(contactId, page, 20, date),
    enabled: contactId > 0,
  })
}

export function useActivityHeatmap(contactId: number) {
  return useQuery({
    queryKey: interactionKeys.heatmap(contactId),
    queryFn: () => api.fetchActivityHeatmap(contactId),
    enabled: contactId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
