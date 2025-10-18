# Audit History UI Mockup

## Overview
This document describes the UI/UX for viewing audit history and performing undo operations.

## User Interface Components

### 1. History Button (App Bar)
**Location:** Top app bar, next to search button
```
[🧙] [🔍] [📜 History] ... [Zoom Controls]
```

**Behavior:**
- Click opens the Audit History modal
- Shows badge with count of recent changes (last 24h)
- Badge color indicates if there are undoable actions

### 2. Audit History Modal

#### Modal Header
```
┌─────────────────────────────────────────────────┐
│ 📜 Audit History                            [✕] │
├─────────────────────────────────────────────────┤
│ Filters: [All Operations ▼] [All Users ▼]      │
│          [Last 24h ▼] [All Calendars ▼]        │
└─────────────────────────────────────────────────┘
```

#### Audit Entry List
Each entry shows:
```
┌─────────────────────────────────────────────────┐
│ UPDATE • 2 minutes ago                     [↩️]  │
│ "Support Request #12345" → "Support #12345"    │
│ By: john@example.com                            │
│ Location: "Room 101" → "Room 202"               │
│ Start: 2025-10-18 14:00 → 2025-10-18 15:00     │
│ ─────────────────────────────────────────────── │
│ CREATE • 1 hour ago                        [↩️]  │
│ "Team Meeting"                                  │
│ By: jane@example.com                            │
│ Calendar: Team Calendar                         │
│ Date: 2025-10-20 10:00 - 11:00                 │
│ ─────────────────────────────────────────────── │
│ DELETE • 3 hours ago                       [↩️]  │
│ "Old Event" (deleted)                           │
│ By: admin@example.com                           │
│ Was in: Personal Calendar                       │
└─────────────────────────────────────────────────┘
```

#### Entry Details (Expandable)
Click on entry to expand:
```
┌─────────────────────────────────────────────────┐
│ ▼ UPDATE • 2 minutes ago                   [↩️]  │
│ "Support Request #12345" → "Support #12345"    │
│ By: john@example.com • Team Calendar            │
│ ───────────────────────────────────────────────│
│ Changes:                                        │
│ ✏️ Summary: "Support Request #12345"           │
│            → "Support #12345"                   │
│ 📍 Location: "Room 101" → "Room 202"           │
│ 🕐 Start: Oct 18, 14:00 → Oct 18, 15:00       │
│ 🕐 End: Oct 18, 15:00 → Oct 18, 16:00         │
│ 📝 Description: (unchanged)                     │
│ ───────────────────────────────────────────────│
│ [Show Full Details] [↩️ Undo This Change]      │
└─────────────────────────────────────────────────┘
```

### 3. Event Modal Integration

Add a "View History" button to the event details modal:

```
┌─────────────────────────────────────────────────┐
│ Event Details                               [✕] │
├─────────────────────────────────────────────────┤
│ Title: [Support #12345                    ]    │
│ Location: [Room 202                       ]    │
│ Start: [2025-10-18] [15:00]                    │
│ End: [2025-10-18] [16:00]                      │
│ ...                                             │
├─────────────────────────────────────────────────┤
│ [📜 View History]  [Delete]  [Cancel]  [Save]  │
└─────────────────────────────────────────────────┘
```

**"View History" Button:**
- Opens audit history modal filtered to this specific event
- Shows timeline of all changes to this event
- Highlights current version

### 4. Undo Confirmation Modal

When user clicks undo (↩️):
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Confirm Undo                             [✕] │
├─────────────────────────────────────────────────┤
│ You are about to undo this change:              │
│                                                  │
│ Operation: UPDATE                                │
│ Made by: john@example.com                        │
│ Time: 2 minutes ago                              │
│                                                  │
│ This will restore:                               │
│ • Summary: "Support #12345"                      │
│   → "Support Request #12345"                     │
│ • Location: "Room 202" → "Room 101"              │
│ • Start: Oct 18, 15:00 → Oct 18, 14:00          │
│                                                  │
│ ⚠️ This action cannot be undone.                │
│                                                  │
├─────────────────────────────────────────────────┤
│ [Cancel]                 [↩️ Confirm Undo]      │
└─────────────────────────────────────────────────┘
```

### 5. Undo Success Toast

After successful undo:
```
┌─────────────────────────────────────────────────┐
│ ✅ Change undone successfully                    │
│ Event restored to previous state                 │
└─────────────────────────────────────────────────┘
```

## Operation-Specific Behaviors

### CREATE (Undo = Delete)
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Undo Create Operation                    [✕] │
├─────────────────────────────────────────────────┤
│ This will DELETE the event:                      │
│ "Team Meeting"                                   │
│                                                  │
│ Created: 1 hour ago by jane@example.com          │
│ Calendar: Team Calendar                          │
│                                                  │
│ ⚠️ The event will be permanently deleted.       │
│                                                  │
├─────────────────────────────────────────────────┤
│ [Cancel]                    [❌ Delete Event]   │
└─────────────────────────────────────────────────┘
```

### DELETE (Undo = Restore)
```
┌─────────────────────────────────────────────────┐
│ ↩️ Restore Deleted Event                    [✕] │
├─────────────────────────────────────────────────┤
│ This will RESTORE the deleted event:             │
│ "Old Event"                                      │
│                                                  │
│ Deleted: 3 hours ago by admin@example.com        │
│ Original calendar: Personal Calendar             │
│                                                  │
│ Details:                                         │
│ • Date: Oct 18, 2025 14:00 - 15:00              │
│ • Location: Room 101                             │
│                                                  │
├─────────────────────────────────────────────────┤
│ [Cancel]                   [✅ Restore Event]   │
└─────────────────────────────────────────────────┘
```

### UPDATE/MOVE (Undo = Restore Previous State)
```
┌─────────────────────────────────────────────────┐
│ ↩️ Undo Changes                             [✕] │
├─────────────────────────────────────────────────┤
│ This will restore the previous version:          │
│                                                  │
│ Summary: "Support #12345"                        │
│       → "Support Request #12345"                 │
│                                                  │
│ Location: "Room 202" → "Room 101"                │
│ Start: Oct 18, 15:00 → Oct 18, 14:00            │
│                                                  │
├─────────────────────────────────────────────────┤
│ [Cancel]                      [↩️ Undo Changes] │
└─────────────────────────────────────────────────┘
```

## Visual Design Specifications

### Color Coding by Operation
- **CREATE**: 🟢 Green accent (`#10b981`)
- **UPDATE**: 🔵 Blue accent (`#3b82f6`)
- **MOVE**: 🟡 Amber accent (`#f59e0b`)
- **DELETE**: 🔴 Red accent (`#ef4444`)

### Status Indicators
- **SUCCESS**: ✅ Green checkmark
- **FAILURE**: ❌ Red X
- **PENDING**: ⏳ Gray clock

### Icons
- History button: 📜
- Undo button: ↩️
- Expand/collapse: ▼/▶
- Operation icons:
  - CREATE: ➕
  - UPDATE: ✏️
  - DELETE: 🗑️
  - MOVE: 🔄

### Responsive Behavior
- **Desktop (>768px)**: Modal 800px wide, side-by-side comparison
- **Tablet (768px-480px)**: Modal 90% width, stacked comparison
- **Mobile (<480px)**: Full-screen modal, simplified layout

## Data Structure

### Audit Entry Display
```javascript
{
  operation: 'UPDATE',
  timestamp: '2025-10-18T13:26:43.110Z',
  status: 'SUCCESS',
  user: {
    email: 'john@example.com',
    name: 'John Doe'
  },
  beforeState: {
    summary: 'Support Request #12345',
    location: 'Room 101',
    start: '2025-10-18T14:00:00',
    end: '2025-10-18T15:00:00',
    calendarUrl: 'https://...'
  },
  afterState: {
    summary: 'Support #12345',
    location: 'Room 202',
    start: '2025-10-18T15:00:00',
    end: '2025-10-18T16:00:00',
    calendarUrl: 'https://...'
  }
}
```

## User Permissions

### Reader Role
- ✅ View audit history
- ❌ Cannot undo operations

### Editor Role  
- ✅ View audit history
- ✅ Undo own operations
- ✅ Undo operations in calendars they can edit

### Admin Role
- ✅ View audit history
- ✅ Undo any operation
- ✅ View audit statistics
- ✅ Access to advanced filters

## Filters & Search

### Quick Filters (Buttons)
```
[All Operations] [My Changes] [Last Hour] [Today] [This Week]
```

### Advanced Filters (Dropdowns)
- **Operation Type**: All, CREATE, UPDATE, MOVE, DELETE
- **User**: All Users, or select from list
- **Time Range**: Last hour, Today, This week, Custom range
- **Calendar**: All Calendars, or select from list
- **Status**: All, Success, Failure

### Search
- Search by event summary
- Search by user email
- Search by event UID

## Error Handling

### Undo Fails (Event No Longer Exists)
```
┌─────────────────────────────────────────────────┐
│ ❌ Undo Failed                              [✕] │
├─────────────────────────────────────────────────┤
│ Cannot undo this change because:                │
│                                                  │
│ • The event no longer exists                     │
│ • The event has been modified since              │
│ • You don't have permission                      │
│                                                  │
│ Please refresh and try again.                    │
│                                                  │
├─────────────────────────────────────────────────┤
│ [Close]                       [Refresh History] │
└─────────────────────────────────────────────────┘
```

### Conflict During Undo
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Conflict Detected                        [✕] │
├─────────────────────────────────────────────────┤
│ The event has been modified since this change.   │
│                                                  │
│ Current state differs from expected state.       │
│ Undoing now may cause unexpected results.        │
│                                                  │
│ Options:                                         │
│ • Cancel and review current state                │
│ • Force undo (may overwrite recent changes)      │
│                                                  │
├─────────────────────────────────────────────────┤
│ [Cancel]  [Review Event]  [⚠️ Force Undo]      │
└─────────────────────────────────────────────────┘
```

## Future Enhancements

### Phase 2
- Bulk undo (select multiple operations)
- Redo functionality
- Compare any two versions
- Export audit log (CSV/JSON)
- Email notifications for changes

### Phase 3
- Audit log visualization (timeline chart)
- Change frequency heatmap
- User activity dashboard
- Automated conflict resolution suggestions

## API Endpoints Used

```javascript
// Get event history
GET /api/audit/event/:uid

// Get recent history (all events)
GET /api/audit/recent?operation=UPDATE&limit=50

// Undo operation
POST /api/audit/undo/:uid

// Get statistics (admin only)
GET /api/audit/stats
```

## Implementation Notes

### Performance
- Paginate results (50 entries per page)
- Lazy load entry details
- Cache recent history (5 min TTL)
- Debounce search input (300ms)

### Accessibility
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader labels for icons
- Focus management in modals
- High contrast mode support

### Mobile Optimizations
- Swipe to open/close modal
- Pull to refresh history
- Compact entry cards
- Bottom sheet instead of modal on mobile
