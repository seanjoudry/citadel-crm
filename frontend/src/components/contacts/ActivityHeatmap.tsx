import CalendarHeatmap from 'react-calendar-heatmap'
import { format, subDays } from 'date-fns'
import 'react-calendar-heatmap/dist/styles.css'

interface HeatmapValue {
  date: string
  count: number
}

interface Props {
  data: HeatmapValue[]
  onDayClick?: (date: string | null) => void
  selectedDate?: string | null
  isLoading?: boolean
}

function getColorClass(value: { date: string; count?: number } | undefined): string {
  if (!value || !value.count || value.count === 0) return 'color-empty'
  if (value.count <= 2) return 'color-scale-1'
  if (value.count <= 5) return 'color-scale-2'
  if (value.count <= 9) return 'color-scale-3'
  return 'color-scale-4'
}

export function ActivityHeatmap({ data, onDayClick, selectedDate, isLoading }: Props) {
  const endDate = new Date()
  const startDate = subDays(endDate, 364)

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="animate-pulse">
          <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
          <div className="h-24 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Activity</h3>
        {selectedDate && (
          <button
            onClick={() => onDayClick?.(null)}
            className="text-xs text-brand hover:underline"
          >
            Show all
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <CalendarHeatmap
          startDate={startDate}
          endDate={endDate}
          values={data}
          classForValue={getColorClass}
          titleForValue={(value) => {
            const v = value as HeatmapValue | undefined
            return v
              ? `${format(new Date(v.date), 'MMM d, yyyy')}: ${v.count} interaction${v.count !== 1 ? 's' : ''}`
              : 'No activity'
          }}
          onClick={(value) => {
            const v = value as HeatmapValue | undefined
            if (onDayClick && v) {
              onDayClick(v.date === selectedDate ? null : v.date)
            }
          }}
        />
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted">
        <span>Less</span>
        <div className="flex gap-0.5">
          <div className="size-3 rounded-sm bg-gray-100" />
          <div className="size-3 rounded-sm bg-green-200" />
          <div className="size-3 rounded-sm bg-green-400" />
          <div className="size-3 rounded-sm bg-green-600" />
          <div className="size-3 rounded-sm bg-green-800" />
        </div>
        <span>More</span>
      </div>
    </div>
  )
}
