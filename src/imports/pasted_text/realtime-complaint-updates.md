The Citizen Portal static UI is already built.

The Dashboard page is already dynamically updating correctly when a complaint is submitted.

Now implement the SAME real-time dynamic behavior for:

1. My Complaints Page
2. Complaint Details Modal
3. Track Complaint Page
4. Status Timeline Section

DO NOT redesign the UI.

KEEP:
- exact spacing
- exact typography
- exact card styles
- exact colors
- exact layout
- exact paddings
- exact visual hierarchy

Only replace the current empty/static states with fully dynamic real-time complaint data.

====================================================
MY COMPLAINTS PAGE
====================================================

CURRENT PROBLEM:
The page still shows:
“No complaints filed yet”

even after complaint submission.

REQUIRED FIX:
Immediately after a complaint is submitted:

- Remove the empty state automatically
- Show dynamic complaint cards instantly
- Update without page refresh
- Sync with dashboard in real time

====================================================
MY COMPLAINTS UI STRUCTURE
====================================================

The page should look EXACTLY like a modern complaint management list.

Top Section:
- Title: “My Complaints”
- Subtitle: “View and manage all your submitted complaints”

Search Row:
- Search input
- Status filter dropdown
- Filter button

Below that:
Dynamic complaints list container.

====================================================
COMPLAINT CARD DESIGN
====================================================

Each complaint row/card must contain:

LEFT SIDE:
- Complaint icon
- Complaint title (bold)
- Small metadata row:
  - complaint ID
  - category
  - date
  - department

RIGHT SIDE:
- Priority badge
- Status badge

Example:
Priority badge:
- Critical → red
- High → orange
- Medium → yellow
- Low → gray

Status badge:
- Submitted → blue
- In Progress → yellow
- Resolved → green
- Escalated → red

====================================================
REAL-TIME BEHAVIOR
====================================================

When a new complaint is submitted:

- New complaint instantly appears in My Complaints
- Complaint count updates automatically
- Empty state disappears automatically
- Search/filter remain functional
- UI updates without reload

====================================================
COMPLAINT DETAILS MODAL
====================================================

When user clicks a complaint card:

Open centered modal popup with dark backdrop.

Modal contains:

TOP:
- Complaint title
- Close button

CONTENT:
- Complaint ID
- Full complaint description

INFO GRID:
- Status
- Priority
- Category
- Department
- AI Confidence
- Sentiment

Design requirements:
- Clean card-style modal
- Rounded corners
- Exact modern aesthetic
- Same design language as existing portal

====================================================
TRACK COMPLAINT PAGE
====================================================

Track Complaint page must dynamically show complaint details after entering complaint ID.

Layout:

TOP:
- Search input
- Search button

RESULT CARD:
- Complaint title
- Complaint ID
- Description
- Category
- Department
- Filed date
- Estimated resolution
- Status badge
- Priority badge

====================================================
STATUS TIMELINE
====================================================

Below complaint details show vertical status timeline.

Timeline stages:

1. Submitted
2. Under Review
3. Assigned
4. In Progress
5. Resolved

Behavior:
- Completed/current step highlighted in blue
- Future steps gray/inactive
- Connected vertical line between stages

Each stage contains:
- icon
- stage title
- small description

Example:
Submitted → “Complaint received and logged”
Under Review → “Being reviewed by officials”
Assigned → “Assigned to department”
In Progress → “Actively being worked on”
Resolved → “Issue successfully resolved”

====================================================
STATE MANAGEMENT
====================================================

All pages must share the SAME complaint state.

Complaint data should sync instantly across:
- Dashboard
- My Complaints
- Track Complaint
- Notifications

No manual refresh allowed.

====================================================
REAL-TIME SYSTEM
====================================================

Implement:
- centralized complaint store
- websocket/socket.io live sync
- shared state updates
- instant UI rendering
- optimistic updates

====================================================
IMPORTANT
====================================================

DO NOT:
- redesign pages
- change layouts
- modify styles
- alter typography
- change spacing

ONLY:
- replace static empty UI with live complaint data
- implement real-time synchronization
- make pages behave exactly like a live grievance management platform

The final result should visually match a modern AI-powered citizen complaint system where complaints instantly appear across all related pages after submission.