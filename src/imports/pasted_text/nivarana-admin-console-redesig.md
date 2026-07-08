Redesign the entire NIVARAN Admin Console UI into a modern enterprise-grade government grievance management dashboard with a clean SaaS-style layout. The current implementation has broken spacing, oversized cards, stretched layouts, poor alignment, incorrect grids, inconsistent heights, and excessive empty whitespace. Completely restructure all pages so the UI becomes compact, balanced, visually polished, and exactly follows the design system described below.

========================
GLOBAL DESIGN SYSTEM
========================

STYLE:
- Modern government-tech SaaS dashboard
- Minimal, premium, clean UI
- Enterprise analytics aesthetic
- Compact and balanced layout
- Professional spacing and alignment
- No oversized empty sections anywhere

FONT:
- Inter font family
- Strong typography hierarchy

COLORS:
Background:
- #f4f7fb

Sidebar:
- dark navy gradient
- #0f1f6d → #13256f

Primary blue:
- #2f5bff

Card background:
- white

Borders:
- #e6ebf2

Muted text:
- #7c8aa5

Primary text:
- #101828

SUCCESS:
- #16c47f

WARNING:
- #f5a524

ERROR:
- #ef4444

CARD STYLE:
- rounded-2xl
- border subtle
- very soft shadow
- padding 20px–24px
- no giant heights
- compact professional sizing

SPACING SYSTEM:
- Page padding: 24px
- Grid gap: 20px
- Card gap: 20px
- Section spacing: 24px
- Internal card spacing: 14px–18px

RESPONSIVE:
Desktop:
- multi-column layouts
Tablet:
- reduce columns
Mobile:
- stack gracefully

IMPORTANT:
- Never stretch cards vertically
- Never create giant blank white areas
- Never stack everything in one column on desktop
- Use proper CSS grid layouts
- Maintain visual balance throughout

========================
SIDEBAR DESIGN
========================

Create a fixed left sidebar.

WIDTH:
- 250px expanded
- collapsible version supported

STYLE:
- dark navy gradient background
- subtle right border
- sticky/fixed full height

TOP SECTION:
- Logo icon inside rounded square
- NIVARAN text
- ADMIN CONSOLE subtitle

DEPARTMENT SWITCHER:
- rounded-xl dark-blue container
- icon left
- dropdown arrow right

NAVIGATION GROUPS:
CORE
- Dashboard
- Complaints
- AI Analytics
- Heatmaps
- Escalation

INSIGHTS
- Reports
- Feedback
- Settings

NAV ITEMS:
- icon + label aligned horizontally
- equal spacing
- hover effect
- active item:
  - blue filled background
  - subtle glow
  - rounded-xl

BOTTOM:
- Sign Out fixed at bottom
- icon + text
- muted red hover effect

ADD:
- sidebar collapse toggle floating near top edge

========================
TOP PAGE HEADER
========================

Every page should start with:

LEFT:
- large bold title
- muted subtitle underneath

RIGHT:
- page actions/buttons

Spacing aligned perfectly.

Titles:
- font-size 34px desktop
- font-weight 700

Subtitles:
- muted
- 16px

========================
DASHBOARD PAGE
========================

LAYOUT STRUCTURE:

SECTION 1:
Top metric cards in ONE HORIZONTAL ROW.

4 equal cards:
1. Total Complaints
2. Pending Action
3. Resolved
4. Escalated

GRID:
- desktop: 4 columns
- tablet: 2 columns
- mobile: 1 column

CARD DESIGN:
- compact
- height around 145px
- icon top-right inside soft colored square
- title uppercase muted small text
- large bold value
- optional trend indicator bottom

Resolved card:
- green trend text

Escalated card:
- soft red icon background

SECTION 2:
3 analytics metric cards in one row.

Cards:
1. AI Routing Accuracy
2. Critical Priority
3. Resolution Rate

STYLE:
- horizontal compact cards
- left colored icon block
- text content right
- not vertically stretched
- equal height

AI Routing:
- blue icon
- value 94%

Critical Priority:
- red icon

Resolution Rate:
- green icon

SECTION 3:
Two-column analytics layout.

LEFT CARD:
Complaint Volume — Last 14 Days
- width 70%
- line chart
- compact chart area
- title top-left
- subtitle underneath

RIGHT CARD:
Priority Split
- width 30%
- centered visualization placeholder
- vertically aligned center

Both same height.

SECTION 4:
Two-column layout.

LEFT:
By Category

RIGHT:
Recent Complaints table

Recent complaints:
- modern compact table
- rounded header section
- muted table header
- centered empty state
- no excessive height

========================
COMPLAINTS PAGE
========================

HEADER:
Title:
Complaints Management

Subtitle:
Review, assign, and resolve citizen complaints

FILTER BAR:
Single horizontal row.

LEFT:
Large search input.

RIGHT:
Two dropdown filters:
- Status
- Priority

SEARCH INPUT:
- rounded-xl
- icon inside left
- proper left padding
- same height as filters

FILTERS:
- equal height
- rounded-xl
- compact width
- aligned perfectly

STATUS OPTIONS:
- All Status
- Submitted
- Under Review
- Assigned
- In Progress
- Resolved
- Escalated

PRIORITY OPTIONS:
- All Priority
- Low
- Medium
- High
- Critical

TABLE:
- modern enterprise table
- compact rows
- subtle row hover
- proper spacing
- empty state centered

COLUMNS:
- Complaint
- Category
- Status
- Priority
- Citizen
- Filed

========================
AI ANALYTICS PAGE
========================

HEADER:
Title:
AI Analytics

Subtitle:
Machine learning insights on complaint patterns

RIGHT:
Generate AI Report button

BUTTON:
- blue filled
- rounded-xl
- icon left
- compact

MAIN LAYOUT:
2x2 analytics grid.

TOP ROW:
LEFT:
By Category

RIGHT:
Sentiment Analysis

BOTTOM ROW:
LEFT:
Priority Breakdown

RIGHT:
Urgency by Category

ALL CARDS:
- equal heights
- compact
- rounded-2xl
- proper padding
- no giant blank spaces

SENTIMENT ANALYSIS:
Legend aligned vertically:
- Positive
- Neutral
- Negative
- Highly Negative

Colored dots aligned left.
Values aligned right.

PRIORITY BREAKDOWN:
- horizontal chart area
- evenly centered

URGENCY BY CATEGORY:
- compact chart container

========================
HEATMAP PAGE
========================

HEADER:
Title:
Complaint Heatmap

Subtitle:
Geographic distribution of citizen complaints

RIGHT:
Category dropdown

FILTER OPTIONS:
- All Categories
- Electricity
- Water Supply
- Roads
- Sanitation
- Public Services
- Drainage
- Healthcare
- Traffic
- Other

TOP STATS ROW:
4 equal compact cards horizontally.

Cards:
1. Total Complaints
2. With Location
3. Visible Pins
4. Location Coverage

STYLE:
- centered values
- label underneath
- equal widths
- compact heights

MAIN MAP CARD:
Large rounded container.

Inside:
- subtle grid/map background
- centered icon
- empty state text
- subtitle underneath

BOTTOM LEGEND:
Horizontal pill chips.

Each chip:
- colored dot
- label
- rounded-full
- compact spacing

Categories:
- Electricity
- Water Supply
- Roads
- Sanitation
- Public Services
- Drainage
- Healthcare
- Traffic
- Other

========================
ESCALATION CENTER PAGE
========================

HEADER:
Title:
Escalation Center

Subtitle:
Manage critical and escalated complaints requiring immediate attention

TOP ALERT ROW:
3 equal horizontal cards.

Cards:
1. Escalated
2. Critical Priority
3. Overdue >7 days

STYLE:
- compact height
- soft tinted backgrounds
- icon left
- large value
- label underneath

COLORS:
Escalated:
- soft red background

Critical:
- soft yellow background

Overdue:
- soft orange background

SECONDARY PANELS:
Stack vertically.

Panels:
1. Escalated Complaints
2. Critical Priority
3. Overdue (>7 days)

PANEL STYLE:
- compact
- title row
- small counter badge right
- centered empty state
- fixed controlled height
- no giant whitespace

========================
IMPORTANT LAYOUT RULES
========================

- Use CSS Grid everywhere
- Align all cards perfectly
- Equalize card heights within rows
- Prevent vertical stretching
- Keep charts compact
- Remove unnecessary whitespace
- Ensure consistent padding
- Ensure responsive behavior
- Maintain balanced proportions
- Use reusable card components
- Keep clean enterprise SaaS aesthetic
- Make entire UI feel premium and production-ready

COMPONENTS TO CREATE:
- Sidebar
- PageHeader
- StatCard
- AnalyticsCard
- ChartCard
- FilterBar
- EmptyState
- TableCard
- MetricTile
- HeatmapLegend
- EscalationPanel

Use Tailwind CSS best practices and modern responsive grid layouts throughout.