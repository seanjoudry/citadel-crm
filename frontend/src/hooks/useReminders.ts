import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/reminders'
import { contactKeys } from './useContacts'

export function useReminders() {
  return useQuery({
    queryKey: ['reminders'],
    queryFn: () => api.fetchReminders().then((r) => r.data),
  })
}

export function useContactReminders(contactId: number) {
  return useQuery({
    queryKey: ['reminders', 'contact', contactId],
    queryFn: () => api.fetchContactReminders(contactId).then((r) => r.data),
    enabled: contactId > 0,
  })
}

export function useCreateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, data }: { contactId: number; data: any }) =>
      api.createReminder(contactId, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: contactKeys.detail(vars.contactId) })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateReminder(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useDeleteReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: api.deleteReminder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
