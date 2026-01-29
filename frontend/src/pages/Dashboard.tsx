import { Link } from 'react-router'
import { format, formatDistanceToNow } from 'date-fns'
import { useDashboard } from '../hooks/useDashboard'
import { useUpdateReminder } from '../hooks/useReminders'
import InitialsAvatar from '../components/shared/InitialsAvatar'
import type { NotableDate } from '../types'

const INTERACTION_LABELS: Record<string, string> = {
  CALL_INBOUND: 'Call (In)', CALL_OUTBOUND: 'Call (Out)', CALL_MISSED: 'Missed Call',
  TEXT_INBOUND: 'Text (In)', TEXT_OUTBOUND: 'Text (Out)',
  EMAIL_INBOUND: 'Email (In)', EMAIL_OUTBOUND: 'Email (Out)',
  MEETING: 'Meeting', MAIL_SENT: 'Mail Sent', MAIL_RECEIVED: 'Mail Received',
  NOTE: 'Note', OTHER: 'Other',
}

export default function Dashboard() {
  const { data, isLoading } = useDashboard()
  const editReminder = useUpdateReminder()

  if (isLoading) return <div className="text-center py-12 text-muted">Loading...</div>
  if (!data) return null

  const { needsAttention, upcomingReminders, upcomingDates, recentActivity, stats } = data

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Contacts" value={stats.totalContacts} />
        <StatCard label="Interactions This Week" value={stats.interactionsThisWeek} />
        <StatCard label="Interactions This Month" value={stats.interactionsThisMonth} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Needs Attention</h2>
          </div>
          {needsAttention.length > 0 ? (
            <div>
              {needsAttention.map((c) => (
                <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <InitialsAvatar firstName={c.firstName} lastName={c.lastName} photoUrl={c.photoUrl} size="sm" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{c.firstName} {c.lastName}</span>
                  </div>
                  <span className="text-xs text-danger">
                    {c.lastContactedAt ? formatDistanceToNow(new Date(c.lastContactedAt), { addSuffix: true }) : 'Never'}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted">All contacts are up to date!</div>
          )}
        </div>

        {/* Upcoming Reminders */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Upcoming Reminders</h2>
          </div>
          {upcomingReminders.length > 0 ? (
            <div>
              {upcomingReminders.map((r) => {
                const isOverdue = new Date(r.remindAt) < new Date()
                return (
                  <div key={r.id} className={`px-4 py-3 border-b border-gray-100 last:border-0 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        {r.contact && (
                          <Link to={`/contacts/${r.contact.id}`} className="text-sm font-medium text-brand hover:underline">
                            {r.contact.firstName} {r.contact.lastName}
                          </Link>
                        )}
                        {r.note && <p className="text-sm text-gray-700">{r.note}</p>}
                        <p className="text-xs text-muted">
                          {format(new Date(r.remindAt), 'MMM d, yyyy h:mm a')}
                          {isOverdue && <span className="text-danger ml-1 font-medium">Overdue</span>}
                        </p>
                      </div>
                      <button onClick={() => editReminder.mutate({ id: r.id, data: { completed: true } })}
                        className="text-xs text-success hover:underline shrink-0">Done</button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted">No upcoming reminders.</div>
          )}
        </div>

        {/* Upcoming Notable Dates */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Upcoming Dates (14 days)</h2>
          </div>
          {upcomingDates.length > 0 ? (
            <div>
              {upcomingDates.map((nd: NotableDate) => {
                const dateLabel = nd.label || nd.type.charAt(0) + nd.type.slice(1).toLowerCase()
                const dateStr = `${new Date(2000, nd.month - 1).toLocaleString('default', { month: 'long' })} ${nd.day}`
                let extra = ''
                if (nd.year) {
                  const age = new Date().getFullYear() - nd.year
                  if (nd.type === 'BIRTHDAY') extra = ` - Turning ${age}`
                  else if (nd.type === 'ANNIVERSARY') extra = ` - ${age} years`
                }
                return (
                  <Link key={nd.id} to={`/contacts/${nd.contact_id || nd.contactId}`}
                    className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <div className="text-sm">
                      <span className="font-medium">{nd.first_name || ''} {nd.last_name || ''}</span>
                      <span className="text-muted"> - {dateLabel}{extra}</span>
                    </div>
                    <p className="text-xs text-muted">{dateStr}</p>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted">No upcoming dates.</div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          </div>
          {recentActivity.length > 0 ? (
            <div>
              {recentActivity.slice(0, 10).map((i) => (
                <Link key={i.id} to={`/contacts/${i.contactId}`}
                  className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                  <div className="flex justify-between">
                    <div className="text-sm">
                      <span className="font-medium">{i.contact?.firstName} {i.contact?.lastName}</span>
                      <span className="text-muted"> - {INTERACTION_LABELS[i.type]}</span>
                    </div>
                    <span className="text-xs text-muted shrink-0">{formatDistanceToNow(new Date(i.occurredAt), { addSuffix: true })}</span>
                  </div>
                  {i.content && <p className="text-xs text-muted truncate mt-0.5">{i.content}</p>}
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-sm text-muted">No recent activity.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
