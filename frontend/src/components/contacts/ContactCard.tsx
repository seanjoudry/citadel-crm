import { Link } from 'react-router'
import { formatDistanceToNow } from 'date-fns'
import type { Contact } from '../../types'
import InitialsAvatar from '../shared/InitialsAvatar'
import TagBadge from '../tags/TagBadge'

interface Props {
  contact: Contact
  attentionThreshold: number
}

export default function ContactCard({ contact, attentionThreshold }: Props) {
  const needsAttention = !contact.lastContactedAt ||
    (Date.now() - new Date(contact.lastContactedAt).getTime()) > attentionThreshold * 86400000

  const hasBirthdaySoon = contact.notableDates?.some((nd) => {
    if (nd.type !== 'BIRTHDAY') return false
    const now = new Date()
    const bday = new Date(now.getFullYear(), nd.month - 1, nd.day)
    if (bday < now) bday.setFullYear(bday.getFullYear() + 1)
    const diff = bday.getTime() - now.getTime()
    return diff >= 0 && diff <= 7 * 86400000
  })

  return (
    <Link
      to={`/contacts/${contact.id}`}
      className="block p-4 hover:bg-gray-50 border-b border-gray-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        <InitialsAvatar
          firstName={contact.firstName}
          lastName={contact.lastName}
          photoUrl={contact.photoUrl}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {contact.firstName} {contact.lastName}
            </span>
            {needsAttention && (
              <span className="shrink-0 inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-danger text-white rounded">
                Needs attention
              </span>
            )}
            {hasBirthdaySoon && (
              <span className="shrink-0 inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-warning text-gray-900 rounded">
                Birthday soon
              </span>
            )}
          </div>
          <div className="text-sm text-muted truncate">
            {[contact.title, contact.organization].filter(Boolean).join(' at ') || contact.email || ''}
          </div>
        </div>
        <div className="text-right text-xs text-muted shrink-0">
          {contact.lastContactedAt ? (
            <span>{formatDistanceToNow(new Date(contact.lastContactedAt), { addSuffix: true })}</span>
          ) : (
            <span className="text-danger">Never contacted</span>
          )}
        </div>
      </div>
      {contact.tags && contact.tags.length > 0 && (
        <div className="flex gap-1 mt-2 ml-13 flex-wrap">
          {contact.tags.map((ct) => (
            <TagBadge key={ct.tagId} name={ct.tag.name} color={ct.tag.color} />
          ))}
        </div>
      )}
    </Link>
  )
}
