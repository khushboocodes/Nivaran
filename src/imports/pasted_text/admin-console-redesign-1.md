You are redesigning the NIVARAN Admin Console into a modern compact SaaS-style governance dashboard.
The current implementation has excessive whitespace, oversized cards, broken spacing, poor grid alignment, inconsistent dropdowns, and incorrect section proportions.
Completely refactor the UI layout and styling to create a clean, highly polished, pixel-perfect admin dashboard with compact spacing and balanced visual hierarchy.

==============================
GLOBAL UI / DESIGN SYSTEM
=========================

STYLE GOAL:
Modern premium SaaS dashboard similar to Linear, Vercel, Stripe Dashboard, Clerk, Notion Admin, and modern analytics platforms.

VISUAL RULES:

* Minimal
* Compact
* Clean
* Soft shadows
* Rounded corners
* Tight spacing
* Balanced layouts
* No oversized containers
* No excessive empty vertical space

COLOR SYSTEM:

* Main background: #F4F7FB
* Sidebar: deep navy blue (#0F1F63 / #13246B)
* Cards: pure white
* Borders: subtle #E5EAF3
* Primary accent: #2F5BFF
* Success: #14B86A
* Warning: #F5A524
* Danger: #EF4444
* Muted text: #7C8AA5

TYPOGRAPHY:

* Headings: bold dark navy
* Body text: muted gray-blue
* Statistics: bold and large
* Small labels: medium weight uppercase
* Font family: Inter or Geist

SPACING:

* Page padding: 24px
* Card padding: 18px–20px
* Grid gap: 18px–20px
* Compact vertical rhythm
* Remove all unnecessary height

BORDER RADIUS:

* Cards: 20px
* Inputs/dropdowns: 14px
* Buttons: 14px
* Small pills/badges: full rounded

SHADOWS:
Use soft subtle shadows only:
box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05)

ANIMATIONS:

* Smooth hover lift on cards
* Soft button transitions
* Dropdown animations
* Sidebar hover highlight

==============================
SIDEBAR REDESIGN
================

Redesign sidebar completely.

Requirements:

* Fixed compact width
* Deep navy background
* Logo at top
* Section labels:
  CORE
  INSIGHTS
* Section labels should be tiny uppercase muted text.
* Navigation items:

  * Rounded pill style
  * Active item highlighted in bright blue
  * Compact vertical spacing
  * Icon + label perfectly centered
  * Smooth hover effect
* Add floating circular collapse button near sidebar edge.
* Keep Sign Out fixed at bottom.
* Sidebar should look modern and premium.

==============================
DASHBOARD PAGE
==============

Completely rebuild the dashboard layout.

TOP HEADER:
Left:

* Title: Overview
* Subtitle with current date

Right:

* Refresh button
* Green Live status badge

LAYOUT STRUCTURE:

ROW 1:
Create a 4-column compact stats grid:

* Total Complaints
* Pending Action
* Resolved
* Escalated

Requirements:

* Equal height compact cards
* Small colored icon container at top-right
* Large bold metric
* Small uppercase label
* Resolved card should show small green rate text
* No oversized height

ROW 2:
Create 3 compact horizontal insight cards:

* AI Routing Accuracy
* Critical Priority
* Resolution Rate

Requirements:

* Horizontal layout
* Icon inside colored square
* Metric large and bold
* Tiny trend arrow
* Small subtitle below metric
* Compact height
* Balanced spacing

ROW 3:
2-column responsive grid:
LEFT (~70%)

* Complaint Volume chart
* Compact line chart
* Reduced chart height
* Proper padding
* Clean axis spacing

RIGHT (~30%)

* Priority Split card
* Compact placeholder panel
* Small subtitle under title

ROW 4:
2-column layout:
LEFT:

* By Category card

RIGHT:

* Recent Complaints table

TABLE REQUIREMENTS:

* Compact rows
* Soft gray header background
* Rounded table container
* Proper empty state centered
* Reduce unused height

IMPORTANT:

* Dashboard should fit naturally on screen without excessive scrolling.
* Cards must NOT stretch vertically.
* Everything should align perfectly.

==============================
COMPLAINTS MANAGEMENT PAGE
==========================

Redesign the complaints page into a professional compact management table UI.

TOP:

* Title
* Subtitle

FILTER BAR:
Single horizontal row:
LEFT:

* Large compact search bar

RIGHT:
Two compact dropdowns:

* Status
* Priority

STATUS OPTIONS:

* Submitted
* Under Review
* Assigned
* In Progress
* Resolved
* Escalated

PRIORITY OPTIONS:

* Low
* Medium
* High
* Critical

DROPDOWN STYLE:

* Rounded modern dropdown
* Compact height
* Soft border
* Consistent sizing

TABLE:

* Rounded container
* Sticky soft gray table header
* Compact row spacing
* Proper column alignment
* Empty state centered gracefully

==============================
AI ANALYTICS PAGE
=================

Redesign analytics into a compact analytics dashboard.

TOP HEADER:
Left:

* AI Analytics title
* Subtitle

Right:

* Generate AI Report button

MAIN LAYOUT:
Responsive 2x2 grid.

TOP LEFT:

* By Category analytics card

TOP RIGHT:

* Sentiment Analysis card

BOTTOM LEFT:

* Priority Breakdown card

BOTTOM RIGHT:

* Urgency by Category card

REQUIREMENTS:

* Equal card heights
* Compact spacing
* Clean chart placeholders
* Consistent padding
* No oversized empty space

SENTIMENT LEGEND:
Use colored dots:

* Blue
* Purple
* Green
* Orange

==============================
COMPLAINT HEATMAP PAGE
======================

Completely redesign heatmap page.

TOP:

* Title + subtitle
* Category dropdown aligned right

CATEGORY OPTIONS:

* All Categories
* Electricity
* Water Supply
* Roads
* Sanitation
* Public Services
* Drainage
* Healthcare
* Traffic
* Other

METRICS ROW:
4 compact equal-width cards:

* Total Complaints
* With Location
* Visible Pins
* Location Coverage

MAIN HEATMAP CARD:

* Large rounded container
* Soft grid-style background
* Inner rounded panel
* Center icon and empty state text:
  “No complaint data”
  “Citizens need to provide coordinates when filing”

BOTTOM:
Create compact colored category legend pills.

LEGEND STYLE:

* Small rounded pills
* Tiny colored dots
* Horizontal wrap layout
* Compact spacing

==============================
ESCALATION CENTER PAGE
======================

Redesign escalation page completely.

TOP:

* Escalation Center title
* Subtitle

TOP METRICS:
3 equal-width compact cards:

* Escalated
* Critical Priority
* Overdue >7 days

STYLE:

* Soft tinted backgrounds
* Colored icon squares
* Compact spacing
* Large metric value

SECTIONS BELOW:
Create stacked escalation panels:

* Escalated Complaints
* Critical Priority
* Overdue (>7 days)

SECTION DESIGN:

* Rounded white card
* Header row:

  * Icon
  * Title
  * Count badge
* Compact empty state centered
* Reduce excessive height
* Consistent spacing

==============================
RESPONSIVENESS
==============

* Use CSS Grid and Flexbox correctly.
* Prevent vertical stretching.
* Optimize for laptop and desktop.
* Keep layouts compact on 1440px screens.
* Maintain balanced proportions.
* Ensure tables/charts/cards align perfectly.

==============================
COMPONENT STANDARDIZATION
=========================

Create reusable components for:

* Stat cards
* Analytics cards
* Dropdowns
* Empty states
* Tables
* Chart containers
* Section headers

Ensure all reusable components:

* Share same radius
* Share same spacing
* Share same shadow
* Share same typography system

==============================
IMPORTANT FINAL RULES
=====================

* Do NOT create oversized cards.
* Remove all unnecessary whitespace.
* Keep everything compact and premium.
* Match modern SaaS dashboard aesthetics.
* Maintain consistent alignment everywhere.
* All pages should feel visually connected.
* Use professional spacing and hierarchy.
* Ensure the UI looks production-ready and polished.
* Prioritize clean grid alignment and compact layout structure.
