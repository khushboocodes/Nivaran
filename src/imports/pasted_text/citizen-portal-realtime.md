The static UI for the Citizen Portal is already fully built.

Your task is ONLY to convert the portal into a fully dynamic, real-time complaint management system while preserving the EXACT existing UI design, layout, styling, spacing, and component structure.

DO NOT redesign anything.

====================================================
CORE REQUIREMENT
====================================================

When a citizen submits a complaint from the “Submit Complaint” page, the entire portal should instantly update everywhere in real time WITHOUT page refresh.

This is a real-time state synchronization task.

All pages must dynamically reflect the newly submitted complaint immediately.

====================================================
REAL-TIME DYNAMIC BEHAVIOR
====================================================

After successful complaint submission:

1. Dashboard updates instantly
2. My Complaints updates instantly
3. Track Complaint page updates instantly
4. Notifications update instantly
5. Analytics cards update instantly
6. Recent activity updates instantly
7. Complaint counters update instantly
8. Timeline and status tracking become active
9. Empty states disappear automatically
10. Newly submitted complaint appears everywhere immediately

====================================================
SUBMIT COMPLAINT PAGE
====================================================

The existing static submit complaint page already exists.

Enhance it with:

- AI-powered complaint analysis
- Dynamic category detection
- Priority detection
- Department assignment
- Sentiment analysis
- AI confidence score
- AI summary generation

When user clicks “Analyze with AI”:
- AI panel updates dynamically in real time.

When user clicks “Submit Complaint”:
- Button enters loading state
- Disable button
- Show spinner
- Change text to “Submitting...”
- After success:
  - show success toast
  - clear form
  - redirect/update portal state

====================================================
DASHBOARD REAL-TIME UPDATES
====================================================

Dashboard cards must update automatically:

- Total Filed
- Pending
- Resolved
- Escalated

Recent Activity section should instantly show:
- newly submitted complaint
- title
- category
- date
- status badge

AI Insights should dynamically update:
- top category
- AI confidence
- resolution rate

====================================================
MY COMPLAINTS PAGE
====================================================

Replace static/empty state with dynamic complaints list.

Each complaint item should contain:
- complaint title
- complaint ID
- category
- department
- date
- priority
- status

Clicking complaint opens detailed modal popup.

====================================================
COMPLAINT DETAILS MODAL
====================================================

Modal should dynamically display:
- title
- complaint ID
- description
- category
- department
- priority
- status
- AI confidence
- sentiment
- timestamps

====================================================
TRACK COMPLAINT PAGE
====================================================

User can enter complaint ID.

System should dynamically fetch complaint and show:
- complaint details
- current status
- estimated resolution
- department
- filed date

====================================================
STATUS TIMELINE
====================================================

Build dynamic vertical timeline:

Stages:
1. Submitted
2. Under Review
3. Assigned
4. In Progress
5. Resolved

Timeline updates automatically based on complaint status.

Completed stages:
- highlighted

Future stages:
- inactive

====================================================
NOTIFICATIONS SYSTEM
====================================================

Create dynamic notifications for:
- complaint submitted
- status updated
- complaint assigned
- complaint resolved
- escalated complaints

Notifications should appear instantly in real time.

====================================================
REAL-TIME ARCHITECTURE
====================================================

Implement:
- centralized complaint state
- shared global store/context
- websocket/socket.io realtime updates
- optimistic UI updates
- live synchronization across pages

Pages should auto-refresh state without manual reload.

====================================================
BACKEND FEATURES
====================================================

Backend should support:

- complaint submission
- AI analysis endpoint
- complaint retrieval
- complaint tracking
- analytics endpoint
- notification storage
- websocket events
- complaint status updates

====================================================
EXPECTED USER EXPERIENCE
====================================================

Flow:

1. User submits complaint
2. AI analyzes complaint
3. Complaint stored
4. Socket event emitted
5. Entire portal updates instantly
6. Dashboard counters change
7. My Complaints populates
8. Track page works immediately
9. Notifications appear
10. Timeline becomes active

====================================================
IMPORTANT
====================================================

DO NOT:
- redesign UI
- change layouts
- change colors
- modify styling
- rebuild components

ONLY:
- make the portal fully dynamic
- add real-time functionality
- connect all pages together
- synchronize complaint state everywhere

The final system should feel like a modern AI-powered live grievance management platform with seamless real-time updates across the entire citizen portal.