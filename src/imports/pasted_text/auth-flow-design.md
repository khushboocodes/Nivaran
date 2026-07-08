Design a complete authentication entry flow for the NIVARAN AI Governance platform based on the provided landing page design. The authentication experience must feel fully integrated with the current visual system and maintain the same modern AI-governance SaaS aesthetic already visible in the homepage and dashboards.

IMPORTANT NAVIGATION FLOW:

1. Landing Page Behavior:

* Clicking “File a Complaint” → opens Citizen Login Page
* Clicking “Citizen Portal” in navbar → opens Citizen Login Page
* Clicking “Admin Console” in navbar → opens Admin Login Page
* Authentication is mandatory before accessing portals
* After successful login:

  * Citizen → redirect to `/citizen/dashboard`
  * Admin → redirect to `/admin/dashboard`

The transition between homepage and login pages should feel smooth, premium, and connected.

OVERALL DESIGN LANGUAGE:

* Match existing homepage exactly
* White/light-gray AI SaaS aesthetic
* Soft grid background pattern
* Blue gradient primary color
* Large bold typography
* Rounded cards
* Soft shadows
* Minimal enterprise styling
* Spacious layout
* Smooth animations
* Modern governance intelligence platform feel
* Consistent spacing and typography hierarchy

---

## CITIZEN LOGIN PAGE

ROUTE:
`/login`

PURPOSE:
Authentication for citizens to submit and track complaints.

DESIGN STYLE:

* Friendly
* Clean
* Modern
* Trustworthy
* AI-powered civic-tech aesthetic

LAYOUT:
Desktop:

* Split-screen layout
* Left side branding/info section
* Right side login card
* Full viewport height

Mobile:

* Vertical stacked layout
* Login card first
* Branding below

BACKGROUND:

* Same subtle grid pattern from homepage
* Light gray/white background
* Soft blurred blue glow shapes in corners
* Floating subtle governance-tech gradients

LEFT PANEL:
Width approx 45%

Content:

* NIVARAN logo at top
* AI Powered badge identical to homepage
* Small live badge:
  “Live — 143 complaints resolved today”
* Large heading:

“AI-Powered Citizen Grievance Portal”

with blue-highlighted text similar to homepage typography.

Description:
“Securely file complaints, track grievance resolution in real-time, and receive AI-powered assistance for faster public service response.”

FEATURE HIGHLIGHTS:
3 stacked feature cards:

1. Real-Time Complaint Tracking
2. AI Complaint Classification
3. Faster Government Resolution

Each card:

* white translucent background
* subtle blur
* rounded-xl
* small colored circular icon
* hover elevation
* subtle border

BOTTOM TRUST SECTION:
“Trusted by Smart Cities”
with same city badges from homepage:

* Municipal Corp. Delhi
* Smart City Pune
* BBMP Bangalore
* Chennai Corp.
* Hyderabad Metro

RIGHT PANEL:
Centered authentication card.

CARD STYLE:

* white background
* 2xl rounded corners
* subtle border
* soft shadow
* width around 420–460px
* clean spacing

TOP SECTION:
Small muted label:
“Citizen Access”

Large heading:
“Welcome Back”

Description:
“Login to continue managing your complaints.”

FORM FIELDS:

1. Email Address
2. Password

Input Style:

* large height
* rounded-xl
* soft gray border
* blue focus ring
* subtle shadow
* same style as dashboard inputs

PASSWORD FIELD:

* eye icon toggle
* animated visibility change

OPTIONS ROW:

* remember me checkbox
* forgot password link

PRIMARY BUTTON:
Text:
“Login to Citizen Portal”

Style:

* blue gradient
* full width
* large rounded-xl
* hover glow
* slight elevation
* arrow icon

DIVIDER:
Horizontal divider with:
“OR”

SECONDARY BUTTON:
“Create Citizen Account”

Outlined button style.

BOTTOM TEXT:
“Need help? Contact civic support”

ANIMATIONS:

* fade-in
* slight upward motion
* card hover transitions
* smooth button animations

---

## CITIZEN SIGNUP PAGE / MODAL

Triggered from:
“Create Citizen Account”

STYLE:
Same visual system.

FIELDS:

* Full Name
* Email Address
* Mobile Number
* Password
* Confirm Password

Optional:

* City/Ward

BUTTON:
“Create Account”

SUCCESS STATE:

* green success animation
* redirect to citizen dashboard

---

## ADMIN LOGIN PAGE

ROUTE:
`/admin/login`

PURPOSE:
Secure administrative access for government departments and officers.

DESIGN STYLE:
This page must feel:

* more secure
* enterprise-grade
* authoritative
* official government SaaS

VISUAL DIFFERENCE:
Compared to citizen login:

* darker tones
* stronger contrast
* enterprise dashboard feel
* deep navy accents matching admin sidebar

LAYOUT:
Desktop:

* left branding panel
* right login card
* 50/50 split

BACKGROUND:

* subtle dark grid overlay
* navy-blue gradients
* floating soft blue glows
* premium governance-tech atmosphere

LEFT PANEL:
Deep navy background matching admin sidebar.

TOP:
NIVARAN ADMIN CONSOLE logo

Badge:
“AI Governance Intelligence”

Large heading:
“Secure Administrative Access”

Description:
“Monitor, classify, escalate, analyze, and resolve citizen grievances through the AI-powered governance intelligence system.”

DASHBOARD PREVIEW CARD:
Show mock analytics mini-cards similar to homepage:

* AI Routing Accuracy
* Total Complaints
* Escalated Cases
* Resolution Rate

Style:

* translucent glass cards
* glowing borders
* enterprise dashboard preview

Include:
small live status badge:
“System Operational”

RIGHT PANEL:
Centered admin authentication card.

CARD STYLE:

* white background
* rounded-2xl
* soft shadow
* premium enterprise form styling

TOP:
Small label:
“Administration Access”

Large heading:
“Sign In”

Description:
“Authorized government personnel only.”

FORM FIELDS:

1. Official Email
2. Password
3. Department Dropdown

Dropdown options:

* Municipal Corporation
* Electricity Department
* Water Supply Board
* Public Works Department
* Sanitation Department
* Healthcare Department

SECURITY FEATURES:

* show/hide password
* remember device checkbox
* forgot password link
* small secure-access badge
* optional 2FA enabled badge

PRIMARY BUTTON:
“Access Admin Console”

Style:

* deep blue gradient
* enterprise-style button
* hover elevation
* subtle glow

BOTTOM SECURITY NOTE:
“All activities are monitored and securely logged.”

ADDITIONAL VISUAL DETAILS:

* subtle animated background particles
* smooth hover states
* enterprise admin SaaS look
* consistent typography with admin dashboard

---

## INTERACTION FLOW

LANDING PAGE:

* File Complaint → Citizen Login
* Citizen Portal → Citizen Login
* Admin Console → Admin Login

AFTER LOGIN:
Citizen:
→ `/citizen/dashboard`

Admin:
→ `/admin/dashboard`

INVALID LOGIN:

* inline error states
* red border
* animated shake effect

LOADING STATE:

* animated button loader
* smooth transition

RESPONSIVENESS:
Must be fully responsive:

* desktop
* tablet
* mobile

TECH STYLE:
React + Vite + Tailwind CSS + shadcn/ui

FINAL GOAL:
The login experience should feel like a premium enterprise AI governance platform that seamlessly extends the already-designed NIVARAN homepage and dashboard ecosystem.
