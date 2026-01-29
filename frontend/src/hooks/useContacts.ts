import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/contacts'
import type { ContactFilters } from '../types'

export const contactKeys = {
  all: ['contacts'] as const,
  lists: () => [...contactKeys.all, 'list'] as const,
  list: (filters: ContactFilters) => [...contactKeys.lists(), filters] as const,
  details: () => [...contactKeys.all, 'detail'] as const,
  detail: (id: number) => [...contactKeys.details(), id] as const,
}

export function useContacts(filters: ContactFilters) {
  return useQuery({
    queryKey: contactKeys.list(filters),
    queryFn: () => api.fetchContacts(filters),
  })
}

export function useContact(id: number) {
  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: () => api.fetchContact(id),
    enabled: id > 0,
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.createContact,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.lists() })
    },
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateContact(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: contactKeys.lists() })
      qc.invalidateQueries({ queryKey: contactKeys.detail(vars.id) })
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteContact,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contactKeys.lists() })
    },
  })
}

export function useAssignTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, tagId }: { contactId: number; tagId: number }) =>
      api.assignTag(contactId, tagId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: contactKeys.detail(vars.contactId) })
      qc.invalidateQueries({ queryKey: contactKeys.lists() })
    },
  })
}

export function useRemoveTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, tagId }: { contactId: number; tagId: number }) =>
      api.removeTag(contactId, tagId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: contactKeys.detail(vars.contactId) })
      qc.invalidateQueries({ queryKey: contactKeys.lists() })
    },
  })
}
