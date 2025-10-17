# Event Planning States Implementation

## Overview
Three-tier event planning state system for better event status visualization.

## The Three States

### 1. **Unconfirmed** (??? marker)
- **Marker:** `???` in event title
- **Visual Design:**
  - White background
  - Border in event type color (coral for vacation, green for support, etc.)
  - Question mark icon `?` at the beginning
  - Gray text color (#6b7280)
- **Use Case:** Events that need confirmation or are tentative

### 2. **Confirmed** (default, no marker)
- **Marker:** None (default state)
- **Visual Design:**
  - Event type background color
  - Standard border
  - White text
  - Standard appearance
- **Use Case:** Regular confirmed events

### 3. **Booked** (! marker)
- **Marker:** `!` in event title
- **Visual Design:**
  - Event type background color
  - **Thick black border (3px)**
  - Checkmark icon ✓ at the beginning
  - White text
  - Subtle shadow for emphasis
- **Use Case:** Locked/finalized events that are confirmed and committed

## Usage Examples

### Creating Events

```
Vacation ??? Sweden              → Unconfirmed vacation
Team Meeting                   → Confirmed meeting (default)
! Board Meeting                → Booked meeting
Support ??? Maybe                → Unconfirmed support shift
! Christmas Break              → Booked vacation
```

### Visual Progression

```
Planning Stage 1: Vacation ??? Sweden
                 (White bg, colored border, ? icon)
                 ↓
Planning Stage 2: Vacation Sweden
                 (Colored bg, standard border)
                 ↓
Planning Stage 3: ! Vacation Sweden
                 (Colored bg, dark gray border, ✓ icon)
```

## Implementation Details

### Configuration
Location: `/mobile/public/js/config.js`

```javascript
export const EVENT_STATES = {
  UNCONFIRMED: {
    marker: '???',
    icon: '?',
    opacity: 1.0
  },
  BOOKED: {
    marker: '!',
    icon: '✓',
    borderColor: '#374151',
    borderWidth: '1px',
    shadow: '0 2px 4px rgba(0,0,0,0.15)'
  }
};
```

### Event Rendering
Location: `/mobile/public/app-simple.js`

The system:
1. Detects markers (`???` or `!`) in event titles
2. Strips markers from display
3. Applies appropriate styling
4. Adds state icons (`?` for unconfirmed, `✓` for booked)

### Modal Display
When viewing event details, the modal shows:
- **Unconfirmed:** Yellow badge with "? Unconfirmed"
- **Booked:** Green badge with "✓ Booked"
- **Confirmed:** No special badge

## Testing Instructions

### 1. Start the Application
```bash
npm start
```

### 2. Create Test Events
Create events with different states to verify the visual design:

- `??? Team Lunch` - Should appear white with question mark icon
- `Project Review` - Should appear with standard event color
- `! Annual Meeting` - Should appear with dark gray border and checkmark

### 3. Verify Visual Design
Check that:
- ✅ Unconfirmed events have white background
- ✅ Unconfirmed events have colored border matching event type
- ✅ Unconfirmed events show question mark icon `?`
- ✅ Booked events have dark gray border (1px)
- ✅ Booked events show checkmark icon `✓`
- ✅ All markers (??? and !) are stripped from displayed titles
- ✅ Modal shows correct state badges

### 4. Test State Changes
Try changing an event's state:
- Add `???` to make it unconfirmed
- Remove `???` to make it confirmed
- Add `!` to make it booked

## Benefits

1. **Clear Visual Hierarchy:** Instantly see which events are tentative vs locked
2. **Quick Scanning:** White events stand out as needing attention
3. **State Progression:** Natural flow from unconfirmed → confirmed → booked
4. **No Dimming:** All events maintain full visibility (no opacity reduction)
5. **Icon Pairing:** Complementary icons (`?` and `✓`) reinforce the state progression
6. **Semantic Clarity:** Question mark for uncertain, checkmark for confirmed

## Notes

- Markers are case-sensitive (must use `???` and `!`)
- Markers can appear anywhere in the title
- Only one state per event (if both ??? and ! exist, booked takes precedence)
- The system works with all event types (vacation, support, meeting, etc.)
