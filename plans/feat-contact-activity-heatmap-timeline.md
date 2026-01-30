# feat: Add Contact Activity Heatmap and Timeline

## Overview

Add a GitHub-style activity heatmap and enhanced timeline to contact profiles, visualizing interaction frequency over time. Users can click heatmap days to filter the timeline, providing quick insight into relationship patterns.

![Reference Design](../screenshot.png)

## Problem Statement / Motivation

- Users have years of interaction data but no visual way to see patterns
- Current activity list is chronological but doesn't show frequency/gaps at a glance
- Understanding "when was I most in touch with this person?" requires scrolling through pages
- The heatmap provides instant visual recognition of relationship intensity over time

## Proposed Solution

### Component 1: Activity Heatmap
- GitHub-style calendar grid showing past 365 days
- Color intensity reflects interaction count per day
- Clickable cells filter the timeline to that date
- Hover tooltip shows date and count

### Component 2: Enhanced Timeline
- Group interactions by date with headers
- Filter mode when heatmap day is selected
- "Show all" option to clear filter
- Existing pagination preserved

### Component 3: New API Endpoint
- Aggregated daily counts for efficient heatmap rendering
- Server-side date filtering for timeline

## Technical Considerations

### Architecture
- **Frontend**: New `ActivityHeatmap.tsx` component using `react-calendar-heatmap`
- **Backend**: New endpoint `GET /api/contacts/:id/activity-heatmap`
- **Database**: Leverage existing index `(contact_id, occurred_at)` for aggregation

### Performance
- Aggregate counts server-side (not fetching all interactions)
- Memoize heatmap data transformation
- Cache heatmap data with 5-min staleTime (changes infrequently)

### Deployment
- Works identically on local PostgreSQL and Railway
- No SQLite differences (project is PostgreSQL-only)
- Vercel frontend uses existing `VITE_API_URL` pattern

## Acceptance Criteria

### Functional
- [ ] Heatmap displays 365 days of activity data on contact detail page
- [ ] Heatmap cells colored by interaction count (5 levels: 0, 1-2, 3-5, 6-9, 10+)
- [ ] Clicking a heatmap day filters timeline to that date
- [ ] Clicking selected day again (or "Show all") clears filter
- [ ] Timeline groups interactions by date with headers
- [ ] Hover on heatmap cell shows tooltip with date and count
- [ ] Legend shows color scale ("Less" to "More")

### Non-Functional
- [ ] Heatmap loads in <500ms for contacts with 10k+ interactions
- [ ] Works on mobile (horizontal scroll for heatmap)
- [ ] Accessible: cells have aria-labels, keyboard navigable (future)

### Edge Cases
- [ ] New contact (0 interactions): Shows empty heatmap + "No interactions yet"
- [ ] Day with 0 interactions clicked: Shows "No interactions on [date]"
- [ ] Future-dated interactions: Excluded from heatmap
- [ ] Adding interaction: Heatmap refreshes to show updated count

## Technical Approach

### Database Query (PostgreSQL)

```sql
-- /api/contacts/:contactId/activity-heatmap
SELECT
  DATE(occurred_at AT TIME ZONE 'UTC') as date,
  COUNT(*) as count
FROM interactions
WHERE contact_id = $1
  AND occurred_at >= CURRENT_DATE - INTERVAL '365 days'
  AND occurred_at <= CURRENT_DATE
GROUP BY DATE(occurred_at AT TIME ZONE 'UTC')
ORDER BY date;
```

### API Response Schema

```typescript
// GET /api/contacts/:contactId/activity-heatmap
interface ActivityHeatmapResponse {
  data: Array<{
    date: string;  // "2025-01-15" (YYYY-MM-DD)
    count: number; // interaction count
  }>;
  meta: {
    totalInteractions: number;
    activeDays: number;
    startDate: string;
    endDate: string;
  };
}
```

### Files to Create

#### `backend/src/routes/activity.ts`
```typescript
import { Router } from 'express'
import prisma from '../config/database.js'

const router = Router()

// GET /api/contacts/:contactId/activity-heatmap
router.get('/contacts/:contactId/activity-heatmap', async (req, res) => {
  const contactId = parseInt(req.params.contactId, 10)

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 365)

  const result = await prisma.$queryRaw`
    SELECT
      TO_CHAR(occurred_at, 'YYYY-MM-DD') as date,
      COUNT(*)::int as count
    FROM interactions
    WHERE contact_id = ${contactId}
      AND occurred_at >= ${startDate}
      AND occurred_at <= ${endDate}
    GROUP BY TO_CHAR(occurred_at, 'YYYY-MM-DD')
    ORDER BY date
  `

  const totalInteractions = result.reduce((sum, d) => sum + d.count, 0)

  res.json({
    data: result,
    meta: {
      totalInteractions,
      activeDays: result.length,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }
  })
})

export default router
```

#### `frontend/src/components/contacts/ActivityHeatmap.tsx`
```tsx
import { useMemo, useState } from 'react'
import CalendarHeatmap from 'react-calendar-heatmap'
import { format, subDays } from 'date-fns'
import 'react-calendar-heatmap/dist/styles.css'

interface Props {
  data: Array<{ date: string; count: number }>
  onDayClick?: (date: string | null) => void
  selectedDate?: string | null
}

export function ActivityHeatmap({ data, onDayClick, selectedDate }: Props) {
  const endDate = new Date()
  const startDate = subDays(endDate, 364)

  const getColorClass = (value: { count: number } | null) => {
    if (!value || value.count === 0) return 'color-empty'
    if (value.count <= 2) return 'color-scale-1'
    if (value.count <= 5) return 'color-scale-2'
    if (value.count <= 9) return 'color-scale-3'
    return 'color-scale-4'
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <CalendarHeatmap
        startDate={startDate}
        endDate={endDate}
        values={data}
        classForValue={getColorClass}
        tooltipDataAttrs={(value) => ({
          'data-tip': value
            ? `${format(new Date(value.date), 'MMM d, yyyy')}: ${value.count} interactions`
            : 'No activity'
        })}
        onClick={(value) => {
          if (onDayClick) {
            onDayClick(value?.date === selectedDate ? null : value?.date || null)
          }
        }}
      />
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
```

#### `frontend/src/hooks/useActivityHeatmap.ts`
```typescript
import { useQuery } from '@tanstack/react-query'

interface HeatmapData {
  date: string
  count: number
}

interface HeatmapResponse {
  data: HeatmapData[]
  meta: {
    totalInteractions: number
    activeDays: number
  }
}

async function fetchActivityHeatmap(contactId: number): Promise<HeatmapResponse> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/contacts/${contactId}/activity-heatmap`)
  if (!response.ok) throw new Error('Failed to fetch activity heatmap')
  return response.json()
}

export function useActivityHeatmap(contactId: number) {
  return useQuery({
    queryKey: ['activity-heatmap', contactId],
    queryFn: () => fetchActivityHeatmap(contactId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

### Files to Modify

#### `frontend/src/pages/ContactDetail.tsx`
- Import `ActivityHeatmap` and `useActivityHeatmap`
- Add `selectedDate` state for filtering
- Render heatmap above Activity section (~line 388)
- Pass `selectedDate` to interactions query
- Add date parameter to interactions API call

#### `backend/src/routes/interactions.ts`
- Add optional `date` query parameter to filter interactions
- When `date` provided, filter to that specific day

#### `frontend/src/index.css`
- Add heatmap color classes for `react-calendar-heatmap`

### CSS to Add

```css
/* Activity Heatmap Colors */
.react-calendar-heatmap .color-empty { fill: #f3f4f6; }
.react-calendar-heatmap .color-scale-1 { fill: #bbf7d0; }
.react-calendar-heatmap .color-scale-2 { fill: #86efac; }
.react-calendar-heatmap .color-scale-3 { fill: #22c55e; }
.react-calendar-heatmap .color-scale-4 { fill: #15803d; }
.react-calendar-heatmap rect:hover { stroke: #374151; stroke-width: 1px; }
.react-calendar-heatmap text { font-size: 8px; fill: #6b7280; }
```

## Dependencies & Risks

### New Dependencies
```bash
npm install react-calendar-heatmap
npm install -D @types/react-calendar-heatmap  # if needed
```

### Risks
| Risk | Mitigation |
|------|------------|
| Slow aggregation for contacts with many interactions | Existing index should handle; add query timeout |
| Timezone confusion (user vs UTC) | Use UTC consistently, document for users |
| Heatmap library styling conflicts | Scope CSS to component, use Tailwind colors |

## Success Metrics

- [ ] Feature ships and works on local + Railway/Vercel
- [ ] Page load time <1s for contacts with 10k interactions
- [ ] Users can visually identify communication patterns
- [ ] Timeline filtering reduces clicks to find specific dates

## References & Research

### Internal References
- Contact Detail Page: `frontend/src/pages/ContactDetail.tsx`
- Interactions Schema: `backend/prisma/schema.prisma:121-135`
- Interactions API: `backend/src/routes/interactions.ts`
- React Query Hooks: `frontend/src/hooks/useInteractions.ts`

### External References
- [react-calendar-heatmap](https://github.com/kevinsqi/react-calendar-heatmap)
- [@uiw/react-heat-map](https://github.com/uiwjs/react-heat-map) (alternative)
- [date-fns](https://date-fns.org/) (already installed)

### Design Reference
- Screenshot: `/Users/seanjoudry/Projects/citadel-crm/screenshot.png`
- Inspiration: Palantini CRM by @arram

---

## Implementation Checklist

### Phase 1: Backend
- [x] Create `backend/src/routes/activity.ts` with heatmap endpoint
- [x] Register route in `backend/src/app.ts`
- [x] Add `date` filter parameter to interactions endpoint
- [x] Test aggregation query performance

### Phase 2: Frontend Components
- [x] Install `react-calendar-heatmap`
- [x] Create `ActivityHeatmap.tsx` component
- [x] Create `useActivityHeatmap.ts` hook (added to existing hooks file)
- [x] Add heatmap CSS to `index.css`

### Phase 3: Integration
- [x] Add heatmap to `ContactDetail.tsx`
- [x] Add date filter state and wire to timeline
- [x] Invalidate heatmap cache on interaction mutations
- [x] Test empty states and edge cases

### Phase 4: Polish
- [x] Add loading skeleton for heatmap
- [ ] Add error state handling
- [ ] Test on mobile viewport
- [ ] Verify Railway/Vercel deployment
