/**
 * English source-of-truth dictionary. Every other locale mirrors this
 * structure — when you add a key here, add it everywhere else too.
 *
 * Keys are namespaced by feature area so we can splice them later if
 * the bundle gets too large.
 */
const en = {
  common: {
    signOut: 'Sign Out',
    language: 'Language',
    markAllRead: 'Mark all as read',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    submit: 'Submit',
    close: 'Close',
    loading: 'Loading…',
    edit: 'Edit',
    remove: 'Remove',
    back: 'Back',
    yes: 'Yes',
    no: 'No',
    confirm: 'Confirm',
    today: 'Today',
    refresh: 'Refresh',
    live: 'Live',
    viewAll: 'View all',
    tryAgain: 'Please try again.',
    portalCitizen: 'Citizen Portal',
    portalAdmin: 'Admin Console',
    days: 'days',
    lessThanADay: 'less than a day',
    avg: 'avg',
  },

  citizen: {
    portalEyebrow: 'Citizen Portal',
    nav: {
      dashboard: 'Dashboard',
      submit: 'Submit Complaint',
      track: 'Track Complaint',
      complaints: 'My Complaints',
      notifications: 'Notifications',
      assistant: 'AI Assistant',
      profile: 'Profile',
    },

    dashboard: {
      welcome: 'Welcome',
      headerTrack: 'Track',
      headerNew: 'New Complaint',

      stats: {
        totalFiled: 'TOTAL FILED',
        totalFiledHint: 'All complaints',
        pending: 'PENDING',
        pendingHint: 'Under review',
        resolved: 'RESOLVED',
        resolutionRate: '{{pct}}% rate',
        escalated: 'ESCALATED',
        escalatedHint: 'Critical priority',
      },

      quickActions: 'QUICK ACTIONS',
      action: {
        fileNew: 'File New Complaint',
        fileNewHint: 'AI-powered submission',
        track: 'Track Complaint',
        trackHint: 'Real-time status',
        assistant: 'AI Assistant',
        assistantHint: 'Ask anything',
        notifications: 'Notifications',
        notificationsHint: 'Updates for you',
      },

      recent: {
        title: 'Recent Activity',
        empty: 'No complaints filed yet',
        emptyHint: 'File your first complaint to get started',
      },

      insights: {
        title: 'AI Insights',
        subtitle: 'Personalized tips from NIVARAN AI',
        topCategory: 'Top Category',
        topCategoryHint: 'Most common issue type',
        confidence: 'AI Confidence',
        confidenceHint: 'Classification accuracy',
        resolutionTitle: 'Resolution Rate',
        resolutionDetail: '{{resolved}} of {{total}} resolved',

        tipTopCategory: '{{category}} is your most-filed category ({{count}} complaints) — track them in My Complaints.',
        tipResolutionRate: '{{pct}}% of your complaints have been resolved so far.',
        tipAvgDays: 'On average your resolved complaints close in {{display}}.',
        tipEscalated: '{{count}} of your complaints are at Critical priority — staff are reviewing them.',
        tipPhotos: 'Add photos when you file — staff resolve photo-backed complaints faster.',
        tipTrack: 'Use Track Complaint with your complaint ID to see the live status timeline.',
        tipLanguage: 'Switch language any time from the sidebar — translations apply across the app.',
      },
    },

    submit: {
      title: 'Submit Complaint',
      fields: {
        title: 'Complaint Title',
        titlePlaceholder: 'Enter a brief title for your complaint',
        description: 'Description',
        descriptionPlaceholder: 'Describe your complaint in detail…',
        category: 'Category',
        categoryPlaceholder: 'Select category',
        language: 'Language',
        location: 'Location',
        locationPlaceholder: 'Enter location or address',
      },
      categories: {
        waterSupply: 'Water Supply',
        electricity: 'Electricity',
        roads: 'Roads & Infrastructure',
        sanitation: 'Sanitation',
        drainage: 'Drainage',
        publicHealth: 'Public Health',
        streetLights: 'Street Lights',
        wasteManagement: 'Waste Management',
        traffic: 'Traffic',
        other: 'Other',
      },
      useLocation: 'Use my location',
      locating: 'Locating…',
      locationDeniedPermission: 'Location permission denied. You can still type an address.',
      locationDeniedOther: 'Could not read your location. Please try again or type an address.',
      locationUnsupported: 'Your browser does not support location access.',
      coordinates: 'Coordinates: {{lat}}, {{lng}}',

      attachments: 'Attachments',
      attach: {
        photo: 'Photo',
        video: 'Video',
        audio: 'Audio',
        record: 'Record',
        stop: 'Stop',
      },
      recordError: {
        unsupported: 'Audio recording is not supported in this browser.',
        denied: 'Microphone permission denied.',
        generic: 'Could not start recording.',
      },
      uploadProgress: 'Uploading attachment {{done}} of {{total}}…',
      tooLarge: 'Files must be 25 MB or smaller.',

      cta: {
        submit: 'Submit Complaint',
        submitting: 'Submitting…',
      },

      ai: {
        title: 'AI Analysis',
        analyzing: 'Analyzing complaint…',
        analyzingHint: 'AI is processing your description',
        confidence: 'AI Confidence',
        category: 'Category',
        department: 'Department',
        priority: 'Priority',
        sentiment: 'Sentiment',
        summary: 'AI Summary',
        emptyTitle: 'Write a description and click "Analyze with AI"',
        emptyHint: 'AI will suggest category, priority, and department',
        analyze: 'Analyze with AI',
        reanalyze: 'Re-analyze',
        analyzingShort: 'Analyzing…',
        needMore: 'Please write a more detailed description for AI analysis',
        unavailable: 'AI analysis is temporarily unavailable. Please try again.',
        signInRequired: 'Please sign in again to analyse your complaint.',
      },

      tips: {
        title: 'Filing Tips',
        beSpecific: 'Be specific about the issue and its location',
        attach: 'Attach photos or videos as evidence',
        useAi: 'Use AI analysis for accurate classification',
        useLanguage: 'Submit in your preferred language',
      },

      validation: {
        missingFields: 'Please fill in all required fields',
        runAi: 'Please run AI analysis before submitting',
      },
      successAlert: '✅ Complaint submitted successfully!\n\nComplaint ID: {{id}}\n\nYou will be redirected to the dashboard.',
      submitFailed: 'Could not submit your complaint. Please try again.',
      uploadFailed: 'Complaint submitted, but {{count}} attachment(s) failed to upload.',
    },

    myComplaints: {
      title: 'My Complaints',
      subtitle: 'View and manage all your submitted complaints',
      empty: 'No complaints yet',
      emptyHint: 'File a new complaint to see it here',
      rate: 'Rate',
      table: {
        complaint: 'Complaint',
        category: 'Category',
        status: 'Status',
        priority: 'Priority',
        filed: 'Filed',
      },
    },

    track: {
      title: 'Track Complaint',
      subtitle: 'Enter a complaint ID to see its real-time status',
      placeholder: 'Enter complaint ID (e.g. cmp_abc123)',
      cta: 'Track',
      notFoundTitle: 'Complaint not found',
      notFoundHint: 'Please check the ID and try again.',
    },

    notifications: {
      title: 'Notifications',
      subtitle: 'Updates on your complaints',
      empty: 'No notifications yet',
      emptyHint: 'Submit a complaint to start receiving updates',
    },

    profile: {
      title: 'My Profile',
      subtitle: 'Manage your account information',
      sections: {
        details: 'Profile Details',
        password: 'Change Password',
      },
      fields: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        city: 'City',
        language: 'Preferred language',
        currentPassword: 'Current password',
        newPassword: 'New password',
        confirmPassword: 'Confirm new password',
      },
      cta: {
        save: 'Save changes',
        update: 'Update password',
      },
      messages: {
        updated: 'Profile updated.',
        passwordChanged: 'Password changed successfully.',
        passwordMismatch: 'New password and confirmation do not match.',
        invalidCurrent: 'Current password is incorrect.',
      },
    },

    assistant: {
      title: 'AI Assistant',
      subtitle: 'Ask anything about civic services',
      placeholder: 'Type your question…',
      send: 'Send',
      suggested: 'Try asking:',
      prompts: {
        howFile: 'How do I file a complaint?',
        howTrack: 'How can I track my complaint?',
        categories: 'Which categories does NIVARAN support?',
        resolution: 'How long does resolution usually take?',
      },
      thinking: 'Thinking…',
      error: 'Sorry, I could not respond just now. Please try again.',
    },
  },

  auth: {
    citizenLogin: {
      title: 'Welcome back',
      subtitle: 'Sign in to your citizen portal',
      email: 'Email',
      password: 'Password',
      cta: 'Sign In',
      signingIn: 'Signing in…',
      forgotPassword: 'Forgot password?',
      noAccount: "Don't have an account?",
      signupLink: 'Sign up',
      adminLink: 'Admin login',
      invalidCredentials: 'Invalid email or password',
    },
    signup: {
      title: 'Create your account',
      subtitle: 'Start filing and tracking civic complaints',
      name: 'Full name',
      phone: 'Phone',
      city: 'City',
      cta: 'Create Account',
      submitting: 'Creating…',
      already: 'Already have an account?',
      loginLink: 'Sign in',
    },
    forgot: {
      title: 'Reset your password',
      subtitle: 'We will email you a reset link',
      cta: 'Send reset link',
      sent: 'If an account exists, you will receive an email shortly.',
    },
  },

  status: {
    submitted: 'Submitted',
    underReview: 'Under Review',
    assigned: 'Assigned',
    inProgress: 'In Progress',
    resolved: 'Resolved',
  },
  priority: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical',
  },
  sentiment: {
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
    highlyNegative: 'Highly Negative',
  },

  admin: {},
  marketing: {},
};

export default en;
