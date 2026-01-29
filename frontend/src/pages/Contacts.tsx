import { useState } from 'react'
import { useContacts, useCreateContact } from '../hooks/useContacts'
import { useTags } from '../hooks/useTags'
import { useGroups } from '../hooks/useGroups'
import { useDebounce } from '../hooks/useDebounce'
import ContactCard from '../components/contacts/ContactCard'
import ContactForm from '../components/contacts/ContactForm'
import SearchBar from '../components/shared/SearchBar'
import Pagination from '../components/shared/Pagination'
import EmptyState from '../components/shared/EmptyState'
import type { ContactFilters } from '../types'

export default function Contacts() {
  const [search, setSearch] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>()
  const [sort, setSort] = useState('name_asc')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)

  const debouncedSearch = useDebounce(search)

  const filters: ContactFilters = {
    search: debouncedSearch || undefined,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    groupId: selectedGroupId,
    sort,
    page,
    limit: 25,
  }

  const { data, isLoading } = useContacts(filters)
  const { data: tags } = useTags()
  const { data: groups } = useGroups()
  const createContact = useCreateContact()

  const handleCreate = async (formData: any) => {
    await createContact.mutateAsync(formData)
    setShowForm(false)
  }

  const toggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
    setPage(1)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-brand text-white rounded-md text-sm font-medium hover:opacity-90"
        >
          + New Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <SearchBar
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search contacts..."
          />
        </div>

        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="name_asc">Name A-Z</option>
          <option value="name_desc">Name Z-A</option>
          <option value="last_contacted_asc">Least recently contacted</option>
          <option value="last_contacted_desc">Most recently contacted</option>
          <option value="created_desc">Newest first</option>
        </select>

        {groups && groups.length > 0 && (
          <select
            value={selectedGroupId ?? ''}
            onChange={(e) => { setSelectedGroupId(e.target.value ? Number(e.target.value) : undefined); setPage(1) }}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tag filter chips */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedTagIds.includes(tag.id)
                  ? 'text-white border-transparent'
                  : 'text-gray-700 border-gray-300 hover:border-gray-400'
              }`}
              style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : {}}
            >
              {tag.name}
            </button>
          ))}
          {selectedTagIds.length > 0 && (
            <button
              onClick={() => { setSelectedTagIds([]); setPage(1) }}
              className="px-2.5 py-1 text-xs text-muted hover:text-gray-900"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Contact list */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center text-muted">Loading...</div>
        ) : data && data.data.length > 0 ? (
          <>
            {data.data.map((contact) => (
              <ContactCard key={contact.id} contact={contact} attentionThreshold={30} />
            ))}
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState
            title="No contacts found"
            description={search || selectedTagIds.length ? 'Try adjusting your filters.' : 'Add your first contact to get started.'}
            action={!search && !selectedTagIds.length ? { label: '+ New Contact', onClick: () => setShowForm(true) } : undefined}
          />
        )}
      </div>

      <ContactForm
        open={showForm}
        onSave={handleCreate}
        onClose={() => setShowForm(false)}
      />
    </div>
  )
}
