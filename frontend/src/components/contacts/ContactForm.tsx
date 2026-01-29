import { useState, useEffect } from 'react'
import type { Contact } from '../../types'
import { CADENCE_OPTIONS } from '../../types'
import { useRegions, useCreateRegion } from '../../hooks/useRegions'

interface Props {
  open: boolean
  contact?: Contact | null
  onSave: (data: any) => void
  onClose: () => void
}

export default function ContactForm({ open, contact, onSave, onClose }: Props) {
  const { data: regions } = useRegions()
  const createRegion = useCreateRegion()
  const [newRegionName, setNewRegionName] = useState('')

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    organization: '',
    title: '',
    location: '',
    photoUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    website: '',
    notes: '',
    regionId: '' as string,
    cadence: '' as string,
  })

  useEffect(() => {
    if (contact) {
      setForm({
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        phone: contact.phone || '',
        email: contact.email || '',
        organization: contact.organization || '',
        title: contact.title || '',
        location: contact.location || '',
        photoUrl: contact.photoUrl || '',
        linkedinUrl: contact.linkedinUrl || '',
        twitterUrl: contact.twitterUrl || '',
        website: contact.website || '',
        notes: contact.notes || '',
        regionId: contact.regionId ? String(contact.regionId) : '',
        cadence: contact.cadence || '',
      })
    } else {
      setForm({
        firstName: '', lastName: '', phone: '', email: '', organization: '', title: '',
        location: '', photoUrl: '', linkedinUrl: '', twitterUrl: '', website: '', notes: '',
        regionId: '', cadence: '',
      })
    }
    setNewRegionName('')
  }, [contact, open])

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { regionId, cadence, ...rest } = form
    onSave({
      ...rest,
      regionId: regionId ? Number(regionId) : null,
      cadence: cadence || null,
    })
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">
              {contact ? 'Edit Contact' : 'New Contact'}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name *" value={form.firstName} onChange={set('firstName')} required />
              <Field label="Last Name *" value={form.lastName} onChange={set('lastName')} required />
              <Field label="Email" value={form.email} onChange={set('email')} type="email" />
              <Field label="Phone" value={form.phone} onChange={set('phone')} />
              <Field label="Organization" value={form.organization} onChange={set('organization')} />
              <Field label="Title" value={form.title} onChange={set('title')} />
              <Field label="Location" value={form.location} onChange={set('location')} />
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={form.regionId}
                  onChange={(e) => setForm((f) => ({ ...f, regionId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">None</option>
                  {(regions || []).map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <div className="flex gap-1 mt-1">
                  <input
                    type="text"
                    value={newRegionName}
                    onChange={(e) => setNewRegionName(e.target.value)}
                    placeholder="New region..."
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-md"
                  />
                  <button
                    type="button"
                    disabled={!newRegionName.trim()}
                    onClick={async () => {
                      const result = await createRegion.mutateAsync({ name: newRegionName.trim() })
                      setForm((f) => ({ ...f, regionId: String(result.data.id) }))
                      setNewRegionName('')
                    }}
                    className="px-2 py-1 text-xs bg-brand text-white rounded-md disabled:opacity-50"
                  >+</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contact Cadence</label>
                <select
                  value={form.cadence}
                  onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">None</option>
                  {CADENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <Field label="Photo URL" value={form.photoUrl} onChange={set('photoUrl')} className="col-span-2" />
              <Field label="LinkedIn" value={form.linkedinUrl} onChange={set('linkedinUrl')} />
              <Field label="Twitter" value={form.twitterUrl} onChange={set('twitterUrl')} />
              <Field label="Website" value={form.website} onChange={set('website')} className="col-span-2" />
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
          <div className="px-6 py-3 bg-gray-50 flex gap-3 justify-end rounded-b-lg">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:opacity-90">
              {contact ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', required, className = '',
}: {
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string; required?: boolean; className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand"
      />
    </div>
  )
}
