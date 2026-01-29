import { useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { format } from 'date-fns'
import { useContact, useUpdateContact, useDeleteContact, useAssignTag, useRemoveTag } from '../hooks/useContacts'
import { useInteractions, useCreateInteraction, useDeleteInteraction } from '../hooks/useInteractions'
import { useContactReminders, useCreateReminder, useUpdateReminder, useDeleteReminder } from '../hooks/useReminders'
import { useTags } from '../hooks/useTags'
import type { InteractionType, NotableDate } from '../types'
import InitialsAvatar from '../components/shared/InitialsAvatar'
import TagBadge from '../components/tags/TagBadge'
import ConfirmDialog from '../components/shared/ConfirmDialog'
import Pagination from '../components/shared/Pagination'
import ContactForm from '../components/contacts/ContactForm'
import { fetchContactNotableDates, createNotableDate, deleteNotableDate } from '../api/notable-dates'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const INTERACTION_LABELS: Record<string, string> = {
  CALL_INBOUND: 'Call (In)',
  CALL_OUTBOUND: 'Call (Out)',
  CALL_MISSED: 'Missed Call',
  TEXT_INBOUND: 'Text (In)',
  TEXT_OUTBOUND: 'Text (Out)',
  EMAIL_INBOUND: 'Email (In)',
  EMAIL_OUTBOUND: 'Email (Out)',
  MEETING: 'Meeting',
  MAIL_SENT: 'Mail Sent',
  MAIL_RECEIVED: 'Mail Received',
  NOTE: 'Note',
  OTHER: 'Other',
}

const QUICK_ACTIONS: { type: InteractionType; label: string }[] = [
  { type: 'CALL_OUTBOUND', label: 'Call' },
  { type: 'TEXT_OUTBOUND', label: 'Text' },
  { type: 'MEETING', label: 'Meeting' },
  { type: 'NOTE', label: 'Note' },
]

export default function ContactDetail() {
  const { contactId } = useParams()
  const navigate = useNavigate()
  const id = parseInt(contactId!, 10)
  const qc = useQueryClient()

  const { data, isLoading } = useContact(id)
  const contact = data?.data

  const [interactionPage, setInteractionPage] = useState(1)
  const { data: interactionsData } = useInteractions(id, interactionPage)

  const { data: reminders } = useContactReminders(id)
  const { data: notableDates } = useQuery({
    queryKey: ['notable-dates', 'contact', id],
    queryFn: () => fetchContactNotableDates(id).then((r) => r.data),
    enabled: id > 0,
  })

  const { data: allTags } = useTags()

  // Mutations
  const updateContact = useUpdateContact()
  const removeContact = useDeleteContact()
  const createInteraction = useCreateInteraction()
  const removeInteraction = useDeleteInteraction()
  const assignTag = useAssignTag()
  const removeTag = useRemoveTag()
  const addReminder = useCreateReminder()
  const editReminder = useUpdateReminder()
  const removeReminder = useDeleteReminder()
  const addNotableDate = useMutation({
    mutationFn: (data: any) => createNotableDate(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notable-dates', 'contact', id] }),
  })
  const removeNotableDate = useMutation({
    mutationFn: deleteNotableDate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notable-dates', 'contact', id] }),
  })

  // UI state
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [showInteractionForm, setShowInteractionForm] = useState<InteractionType | null>(null)
  const [interactionContent, setInteractionContent] = useState('')
  const [interactionDuration, setInteractionDuration] = useState('')
  const [interactionDate, setInteractionDate] = useState(new Date().toISOString().slice(0, 16))
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderNote, setReminderNote] = useState('')
  const [showDateForm, setShowDateForm] = useState(false)
  const [dateFormData, setDateFormData] = useState({ type: 'BIRTHDAY', label: '', month: 1, day: 1, year: '', recurring: true, notes: '' })
  const [showTagPicker, setShowTagPicker] = useState(false)

  if (isLoading) return <div className="text-center py-12 text-muted">Loading...</div>
  if (!contact) return <div className="text-center py-12 text-muted">Contact not found</div>

  const daysSinceLastContact = contact.lastContactedAt
    ? Math.floor((Date.now() - new Date(contact.lastContactedAt).getTime()) / 86400000)
    : null

  const handleDelete = async () => {
    await removeContact.mutateAsync(id)
    navigate('/contacts')
  }

  const handleUpdate = async (formData: any) => {
    await updateContact.mutateAsync({ id, data: formData })
    setShowEdit(false)
  }

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!showInteractionForm) return
    await createInteraction.mutateAsync({
      contactId: id,
      data: {
        type: showInteractionForm,
        content: interactionContent || undefined,
        durationSeconds: interactionDuration ? parseInt(interactionDuration) * 60 : undefined,
        occurredAt: new Date(interactionDate).toISOString(),
      },
    })
    setShowInteractionForm(null)
    setInteractionContent('')
    setInteractionDuration('')
    setInteractionDate(new Date().toISOString().slice(0, 16))
  }

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    await addReminder.mutateAsync({
      contactId: id,
      data: { remindAt: new Date(reminderDate).toISOString(), note: reminderNote || undefined },
    })
    setShowReminderForm(false)
    setReminderDate('')
    setReminderNote('')
  }

  const handleAddDate = async (e: React.FormEvent) => {
    e.preventDefault()
    await addNotableDate.mutateAsync({
      type: dateFormData.type,
      label: dateFormData.label || undefined,
      month: dateFormData.month,
      day: dateFormData.day,
      year: dateFormData.year ? parseInt(dateFormData.year) : undefined,
      recurring: dateFormData.recurring,
      notes: dateFormData.notes || undefined,
    })
    setShowDateForm(false)
    setDateFormData({ type: 'BIRTHDAY', label: '', month: 1, day: 1, year: '', recurring: true, notes: '' })
  }

  const contactTags = contact.tags || []
  const assignedTagIds = new Set(contactTags.map((ct) => ct.tagId))
  const unassignedTags = (allTags || []).filter((t) => !assignedTagIds.has(t.id))

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <InitialsAvatar firstName={contact.firstName} lastName={contact.lastName} photoUrl={contact.photoUrl} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{contact.firstName} {contact.lastName}</h1>
          <p className="text-muted">
            {[contact.title, contact.organization].filter(Boolean).join(' at ')}
          </p>
          {contact.location && <p className="text-sm text-muted">{contact.location}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {contact.email && <a href={`mailto:${contact.email}`} className="text-sm text-brand hover:underline">{contact.email}</a>}
            {contact.phone && <span className="text-sm text-muted">{contact.phone}</span>}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {contactTags.map((ct) => (
              <TagBadge key={ct.tagId} name={ct.tag.name} color={ct.tag.color} onRemove={() => removeTag.mutate({ contactId: id, tagId: ct.tagId })} />
            ))}
            <button onClick={() => setShowTagPicker(!showTagPicker)} className="px-2 py-0.5 text-xs border border-dashed border-gray-300 rounded-full text-muted hover:border-gray-400">+ Tag</button>
          </div>
          {showTagPicker && unassignedTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {unassignedTags.map((tag) => (
                <button key={tag.id} onClick={() => { assignTag.mutate({ contactId: id, tagId: tag.id }); setShowTagPicker(false) }}
                  className="px-2 py-0.5 text-xs border border-gray-300 rounded-full hover:bg-gray-100">{tag.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowEdit(true)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Edit</button>
          <button onClick={() => setShowDelete(true)} className="px-3 py-1.5 text-sm border border-danger text-danger rounded-md hover:bg-red-50">Delete</button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex gap-4 mb-6 text-sm">
        <div className="px-3 py-2 bg-gray-100 rounded-md">
          <span className="text-muted">Last contact: </span>
          <span className={daysSinceLastContact !== null && daysSinceLastContact > 30 ? 'text-danger font-medium' : ''}>
            {daysSinceLastContact !== null ? `${daysSinceLastContact} days ago` : 'Never'}
          </span>
        </div>
        {contact.linkedinUrl && <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100">LinkedIn</a>}
        {contact.twitterUrl && <a href={contact.twitterUrl} target="_blank" rel="noreferrer" className="px-3 py-2 bg-sky-50 text-sky-700 rounded-md hover:bg-sky-100">Twitter</a>}
        {contact.website && <a href={contact.website} target="_blank" rel="noreferrer" className="px-3 py-2 bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100">Website</a>}
      </div>

      {contact.notes && (
        <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm">{contact.notes}</div>
      )}

      {/* Quick actions */}
      <div className="flex gap-2 mb-6">
        {QUICK_ACTIONS.map((a) => (
          <button key={a.type} onClick={() => { setShowInteractionForm(a.type); setInteractionDate(new Date().toISOString().slice(0, 16)) }}
            className="px-3 py-2 text-sm bg-brand text-white rounded-md hover:opacity-90">{a.label}</button>
        ))}
        <select
          onChange={(e) => { if (e.target.value) { setShowInteractionForm(e.target.value as InteractionType); setInteractionDate(new Date().toISOString().slice(0, 16)) } }}
          value=""
          className="px-3 py-2 text-sm border border-gray-300 rounded-md"
        >
          <option value="">More...</option>
          <option value="EMAIL_INBOUND">Email (In)</option>
          <option value="EMAIL_OUTBOUND">Email (Out)</option>
          <option value="MAIL_SENT">Mail Sent</option>
          <option value="MAIL_RECEIVED">Mail Received</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Interaction form */}
      {showInteractionForm && (
        <form onSubmit={handleLogInteraction} className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Log: {INTERACTION_LABELS[showInteractionForm]}</h3>
          <textarea value={interactionContent} onChange={(e) => setInteractionContent(e.target.value)}
            placeholder="Notes..." rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3" />
          <div className="flex gap-3 items-end">
            {showInteractionForm.includes('CALL') || showInteractionForm === 'MEETING' ? (
              <div>
                <label className="text-xs text-muted">Duration (min)</label>
                <input type="number" value={interactionDuration} onChange={(e) => setInteractionDuration(e.target.value)}
                  className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
              </div>
            ) : null}
            <div>
              <label className="text-xs text-muted">When</label>
              <input type="datetime-local" value={interactionDate} onChange={(e) => setInteractionDate(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
            </div>
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={() => setShowInteractionForm(null)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md">Cancel</button>
              <button type="submit" className="px-3 py-1.5 text-sm bg-brand text-white rounded-md">Save</button>
            </div>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Timeline (2/3 width) */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-3">Activity</h2>
          <div className="bg-white border border-gray-200 rounded-lg">
            {interactionsData && interactionsData.data.length > 0 ? (
              <>
                {interactionsData.data.map((interaction) => (
                  <div key={interaction.id} className="p-3 border-b border-gray-100 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-medium px-1.5 py-0.5 bg-gray-100 rounded">{INTERACTION_LABELS[interaction.type]}</span>
                        {interaction.durationSeconds && (
                          <span className="text-xs text-muted ml-2">{Math.round(interaction.durationSeconds / 60)} min</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted">{format(new Date(interaction.occurredAt), 'MMM d, yyyy h:mm a')}</span>
                        <button onClick={() => removeInteraction.mutate(interaction.id)} className="text-xs text-muted hover:text-danger">x</button>
                      </div>
                    </div>
                    {interaction.content && <p className="text-sm mt-1 text-gray-700">{interaction.content}</p>}
                  </div>
                ))}
                <Pagination page={interactionsData.meta.page} totalPages={interactionsData.meta.totalPages} onPageChange={setInteractionPage} />
              </>
            ) : (
              <div className="p-8 text-center text-muted text-sm">No interactions yet. Use the buttons above to log one.</div>
            )}
          </div>
        </div>

        {/* Sidebar (1/3 width) */}
        <div className="space-y-6">
          {/* Reminders */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Reminders</h3>
              <button onClick={() => setShowReminderForm(true)} className="text-xs text-brand hover:underline">+ Add</button>
            </div>
            {showReminderForm && (
              <form onSubmit={handleAddReminder} className="mb-3 p-3 bg-gray-50 rounded-md">
                <input type="datetime-local" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} required
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm mb-2" />
                <input type="text" value={reminderNote} onChange={(e) => setReminderNote(e.target.value)} placeholder="Note..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm mb-2" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowReminderForm(false)} className="text-xs text-muted">Cancel</button>
                  <button type="submit" className="text-xs text-brand font-medium">Save</button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {reminders?.map((r) => {
                const isOverdue = !r.completed && new Date(r.remindAt) < new Date()
                return (
                  <div key={r.id} className={`p-2 text-sm rounded-md border ${r.completed ? 'bg-gray-50 border-gray-200 line-through text-muted' : isOverdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        {r.note && <p>{r.note}</p>}
                        <p className="text-xs text-muted">{format(new Date(r.remindAt), 'MMM d, yyyy h:mm a')}</p>
                        {isOverdue && <span className="text-xs text-danger font-medium">Overdue</span>}
                      </div>
                      <div className="flex gap-1">
                        {!r.completed && (
                          <button onClick={() => editReminder.mutate({ id: r.id, data: { completed: true } })} className="text-xs text-success hover:underline">Done</button>
                        )}
                        <button onClick={() => removeReminder.mutate(r.id)} className="text-xs text-muted hover:text-danger">x</button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {(!reminders || reminders.length === 0) && <p className="text-xs text-muted">No reminders.</p>}
            </div>
          </div>

          {/* Notable Dates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Notable Dates</h3>
              <button onClick={() => setShowDateForm(true)} className="text-xs text-brand hover:underline">+ Add</button>
            </div>
            {showDateForm && (
              <form onSubmit={handleAddDate} className="mb-3 p-3 bg-gray-50 rounded-md space-y-2">
                <select value={dateFormData.type} onChange={(e) => setDateFormData((d) => ({ ...d, type: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm">
                  <option value="BIRTHDAY">Birthday</option>
                  <option value="ANNIVERSARY">Anniversary</option>
                  <option value="FIRST_MET">First Met</option>
                  <option value="ELECTION">Election</option>
                  <option value="CUSTOM">Custom</option>
                </select>
                {dateFormData.type === 'CUSTOM' && (
                  <input type="text" value={dateFormData.label} onChange={(e) => setDateFormData((d) => ({ ...d, label: e.target.value }))}
                    placeholder="Label..." className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                )}
                <div className="flex gap-2">
                  <select value={dateFormData.month} onChange={(e) => setDateFormData((d) => ({ ...d, month: parseInt(e.target.value) }))}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm">
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                    ))}
                  </select>
                  <input type="number" min="1" max="31" value={dateFormData.day} onChange={(e) => setDateFormData((d) => ({ ...d, day: parseInt(e.target.value) || 1 }))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-md text-sm" placeholder="Day" />
                </div>
                <input type="number" value={dateFormData.year} onChange={(e) => setDateFormData((d) => ({ ...d, year: e.target.value }))}
                  placeholder="Year (optional)" className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={dateFormData.recurring} onChange={(e) => setDateFormData((d) => ({ ...d, recurring: e.target.checked }))} />
                  Recurring
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowDateForm(false)} className="text-xs text-muted">Cancel</button>
                  <button type="submit" className="text-xs text-brand font-medium">Save</button>
                </div>
              </form>
            )}
            <div className="space-y-2">
              {notableDates?.map((nd: NotableDate) => {
                const dateLabel = nd.label || nd.type.charAt(0) + nd.type.slice(1).toLowerCase()
                const dateStr = `${new Date(2000, nd.month - 1).toLocaleString('default', { month: 'long' })} ${nd.day}`
                let ageStr = ''
                if (nd.year) {
                  const thisYear = new Date().getFullYear()
                  const age = thisYear - nd.year
                  if (nd.type === 'BIRTHDAY') ageStr = ` (Turning ${age})`
                  else if (nd.type === 'ANNIVERSARY') ageStr = ` (${age} years)`
                }
                return (
                  <div key={nd.id} className="flex justify-between items-start p-2 text-sm bg-white border border-gray-200 rounded-md">
                    <div>
                      <span className="font-medium">{dateLabel}</span>{ageStr}
                      <p className="text-xs text-muted">{dateStr}{nd.year ? `, ${nd.year}` : ''} {nd.recurring ? '(recurring)' : ''}</p>
                    </div>
                    <button onClick={() => removeNotableDate.mutate(nd.id)} className="text-xs text-muted hover:text-danger">x</button>
                  </div>
                )
              })}
              {(!notableDates || notableDates.length === 0) && <p className="text-xs text-muted">No notable dates.</p>}
            </div>
          </div>

          {/* Groups */}
          {contact.groups && contact.groups.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Groups</h3>
              <div className="space-y-1">
                {contact.groups.map((cg) => (
                  <div key={cg.groupId} className="text-sm px-2 py-1 bg-gray-100 rounded">{cg.group.name}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ContactForm open={showEdit} contact={contact} onSave={handleUpdate} onClose={() => setShowEdit(false)} />
      <ConfirmDialog
        open={showDelete}
        title="Delete Contact"
        message={`Are you sure you want to delete ${contact.firstName} ${contact.lastName}? This will also delete all their interactions, reminders, and notable dates.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}
