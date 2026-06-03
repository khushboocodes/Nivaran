Redesign the NIVARAN authentication flow into a minimal modern centered-auth layout by removing the entire left-side branding/info section from both login pages.

The design should now focus only on a premium centered authentication card experience while maintaining the same NIVARAN AI-governance design system, colors, typography, spacing, shadows, and modern SaaS styling already used in the landing page and dashboards.

==================================================
GLOBAL AUTH DESIGN SYSTEM
=========================

STYLE:

* Clean AI SaaS interface
* Minimal government-tech platform aesthetic
* White/light-gray backgrounds
* Subtle grid pattern background
* Blue gradient primary theme
* Rounded corners
* Soft shadows
* Spacious padding
* Professional but modern

BACKGROUND:

* Full-page light background
* Very subtle grid overlay like homepage
* Soft blurred blue radial glow in corners
* Minimal floating gradients
* No split layout anymore
* Entire focus centered on auth card

LAYOUT:

* Horizontally and vertically centered auth card
* Max width around 440px
* Full responsive design
* Mobile-first responsiveness
* Smooth fade/slide animations

==================================================
CITIZEN LOGIN PAGE
==================

ROUTE:
`/login`

PAGE PURPOSE:
Citizen authentication before entering grievance dashboard.

CARD DESIGN:

* white card
* rounded-3xl
* soft border
* subtle shadow
* centered
* premium spacing
* width around 430–450px

TOP HEADER:
Centered NIVARAN logo

Below logo:
small AI Powered badge

Small muted label:
“Citizen Access”

Main heading:
“Welcome Back”

Subtext:
“Login to continue managing your complaints.”

FORM FIELDS:

1. Email Address
2. Password

INPUT STYLE:

* rounded-xl
* height around 52px
* light border
* blue focus ring
* modern input styling
* placeholder text muted gray

PASSWORD FIELD:

* eye visibility toggle icon

OPTIONS ROW:
Left:

* remember me checkbox

Right:

* forgot password link

PRIMARY BUTTON:
Text:
“Login to Citizen Portal”

STYLE:

* blue gradient button
* full width
* rounded-xl
* height around 52px
* white text
* subtle hover glow
* arrow icon on right

DIVIDER:
horizontal divider with “OR”

SECONDARY BUTTON:
“Create Citizen Account”

STYLE:

* outlined button
* rounded-xl
* hover background
* same height as primary button

BOTTOM HELP TEXT:
“Need help? Contact civic support”

ANIMATIONS:

* fade in
* slight upward motion
* button hover scaling
* smooth transitions

RESPONSIVE:

* centered card on all devices
* padding optimized for mobile

==================================================
CREATE CITIZEN ACCOUNT PAGE
===========================

ROUTE:
`/signup`

PURPOSE:
Citizen registration page for new users.

STYLE:
Use exact same auth card layout and styling as login page for consistency.

CARD HEADER:
Centered NIVARAN logo

Small label:
“Citizen Registration”

Main heading:
“Create Your Account”

Subtext:
“Register to file and track grievances securely.”

FORM FIELDS:

1. Full Name
2. Email Address
3. Mobile Number
4. City / Ward (optional)
5. Password
6. Confirm Password

FIELD STYLING:

* same as login page
* rounded-xl
* soft border
* clean spacing
* password visibility toggle

OPTIONAL FEATURES:

* password strength indicator
* live validation
* checkmark success states

TERMS SECTION:
Checkbox:
“I agree to the Terms & Privacy Policy”

PRIMARY BUTTON:
“Create Citizen Account”

STYLE:

* same blue gradient
* full width
* rounded-xl
* hover glow

BOTTOM SECTION:
Text:
“Already have an account?”

Clickable:
“Login”

SUCCESS FLOW:

* successful signup animation
* redirect to `/citizen/dashboard`

ERROR STATES:

* inline validation
* red border
* helper text

==================================================
ADMIN LOGIN PAGE
================

ROUTE:
`/admin/login`

IMPORTANT:
Remove the entire left analytics section completely.

NEW LAYOUT:
Only centered admin auth card.

BACKGROUND:

* subtle dark navy gradient overlay
* light AI grid texture
* premium governance-tech feel
* soft glowing blue accents

CARD STYLE:

* centered white auth card
* rounded-3xl
* soft shadow
* width around 440px

TOP:
Centered NIVARAN ADMIN logo

Small badge:
“AI Governance Intelligence”

Small muted label:
“Administration Access”

Main heading:
“Sign In”

Subtext:
“Authorized government personnel only.”

FORM FIELDS:

1. Official Email
2. Password
3. Department Dropdown

DEPARTMENT OPTIONS:

* Municipal Corporation
* Electricity Department
* Water Supply Board
* Public Works Department
* Sanitation Department
* Healthcare Department

PASSWORD FIELD:

* visibility toggle

OPTIONS ROW:

* remember device checkbox
* forgot password link

PRIMARY BUTTON:
“Access Admin Console”

STYLE:

* deep blue gradient
* enterprise-style
* subtle hover elevation
* white text

SECURITY BADGE BELOW BUTTON:
Green shield icon + text:
“2FA enabled for enhanced security”

BOTTOM SECURITY TEXT:
“All activities are monitored and securely logged.”

==================================================
NAVIGATION FLOW
===============

Landing Page:

* File Complaint → `/login`
* Citizen Portal → `/login`
* Admin Console → `/admin/login`

Citizen Login:

* successful login → `/citizen/dashboard`
* create account button → `/signup`

Signup:

* successful signup → `/citizen/dashboard`
* already have account → `/login`

Admin Login:

* successful login → `/admin/dashboard`

==================================================
TECH STACK
==========

Design for:

* React
* Vite
* Tailwind CSS
* shadcn/ui

FINAL GOAL:
The authentication system should feel like a modern premium AI-powered governance SaaS product with a minimal centered experience instead of split-screen layouts.
