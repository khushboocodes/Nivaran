/**
 * Tamil partial translation. i18next falls back to the English source-of-truth
 * for any key not explicitly listed here, so we focus on the most user-visible
 * strings (nav, page titles, primary CTAs, stat labels, key tips) rather than
 * translating every micro-string.
 */
const ta = {
  common: {
    signOut: 'வெளியேறு',
    language: 'மொழி',
    markAllRead: 'அனைத்தையும் படித்ததாக குறிக்கவும்',
    cancel: 'ரத்துசெய்',
    save: 'சேமி',
    saving: 'சேமிக்கிறது…',
    saved: 'சேமிக்கப்பட்டது',
    submit: 'சமர்ப்பி',
    close: 'மூடு',
    loading: 'ஏற்றுகிறது…',
    edit: 'திருத்து',
    remove: 'நீக்கு',
    back: 'பின்',
    refresh: 'புதுப்பி',
    live: 'நேரலை',
    viewAll: 'அனைத்தையும் காண்க',
    portalCitizen: 'குடிமக்கள் போர்ட்டல்',
    days: 'நாட்கள்',
  },

  citizen: {
    portalEyebrow: 'குடிமக்கள் போர்ட்டல்',
    nav: {
      dashboard: 'டாஷ்போர்டு',
      submit: 'புகார் பதிவு',
      track: 'புகாரைக் கண்காணி',
      complaints: 'எனது புகார்கள்',
      notifications: 'அறிவிப்புகள்',
      assistant: 'AI உதவியாளர்',
      profile: 'சுயவிவரம்',
    },

    dashboard: {
      welcome: 'வரவேற்கிறோம்',
      headerTrack: 'கண்காணி',
      headerNew: 'புதிய புகார்',
      stats: {
        totalFiled: 'மொத்தம் பதிவு',
        totalFiledHint: 'அனைத்து புகார்கள்',
        pending: 'நிலுவையில்',
        pendingHint: 'பரிசீலனையில்',
        resolved: 'தீர்க்கப்பட்டது',
        resolutionRate: '{{pct}}% விகிதம்',
        escalated: 'அதிகரிக்கப்பட்டது',
        escalatedHint: 'முக்கியமான முன்னுரிமை',
      },
      quickActions: 'விரைவு செயல்கள்',
      action: {
        fileNew: 'புதிய புகார் பதிவு',
        fileNewHint: 'AI-இயக்கப்பட்ட சமர்ப்பிப்பு',
        track: 'புகாரைக் கண்காணி',
        trackHint: 'நேரடி நிலை',
        assistant: 'AI உதவியாளர்',
        assistantHint: 'எதையும் கேள்',
        notifications: 'அறிவிப்புகள்',
        notificationsHint: 'உங்களுக்கான புதுப்பிப்புகள்',
      },
      recent: {
        title: 'சமீபத்திய செயல்பாடு',
        empty: 'இதுவரை புகார்கள் இல்லை',
        emptyHint: 'தொடங்க உங்கள் முதல் புகாரை பதிவுசெய்யவும்',
      },
      insights: {
        title: 'AI நுண்ணறிவு',
        subtitle: 'NIVARAN AI-இலிருந்து தனிப்பட்ட குறிப்புகள்',
        topCategory: 'முதன்மை வகை',
        topCategoryHint: 'மிகவும் பொதுவான பிரச்சினை',
        confidence: 'AI நம்பிக்கை',
        confidenceHint: 'வகைப்படுத்தல் துல்லியம்',
        resolutionTitle: 'தீர்வு விகிதம்',
        resolutionDetail: '{{total}}-இல் {{resolved}} தீர்க்கப்பட்டது',
      },
    },

    submit: {
      title: 'புகார் பதிவு',
      fields: {
        title: 'புகார் தலைப்பு',
        description: 'விளக்கம்',
        category: 'வகை',
        language: 'மொழி',
        location: 'இடம்',
      },
      attachments: 'இணைப்புகள்',
      attach: { photo: 'புகைப்படம்', video: 'வீடியோ', audio: 'ஆடியோ', record: 'பதிவு', stop: 'நிறுத்து' },
      cta: { submit: 'புகாரை சமர்ப்பி', submitting: 'சமர்ப்பிக்கிறது…' },
      ai: {
        title: 'AI பகுப்பாய்வு',
        analyze: 'AI-இல் பகுப்பாய்வு',
        reanalyze: 'மறுபடியும் பகுப்பாய்',
      },
    },

    myComplaints: { title: 'எனது புகார்கள்', empty: 'இதுவரை புகார்கள் இல்லை' },
    track: { title: 'புகாரைக் கண்காணி', cta: 'கண்காணி' },
    notifications: { title: 'அறிவிப்புகள்', empty: 'இதுவரை அறிவிப்புகள் இல்லை' },
    profile: { title: 'எனது சுயவிவரம்' },
    assistant: { title: 'AI உதவியாளர்', send: 'அனுப்பு' },
  },

  auth: {
    citizenLogin: { title: 'மீண்டும் வரவேற்கிறோம்', cta: 'உள்நுழை', email: 'மின்னஞ்சல்', password: 'கடவுச்சொல்' },
    signup: { title: 'கணக்கை உருவாக்கு', cta: 'கணக்கை உருவாக்கு' },
  },

  status: {
    submitted: 'சமர்ப்பிக்கப்பட்டது',
    underReview: 'பரிசீலனையில்',
    assigned: 'ஒதுக்கப்பட்டது',
    inProgress: 'நடைபெறுகிறது',
    resolved: 'தீர்க்கப்பட்டது',
  },
  priority: { low: 'குறைவு', medium: 'நடுத்தர', high: 'அதிக', critical: 'முக்கியம்' },
};

export default ta;
