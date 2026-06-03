/** Telugu — partial; missing keys fall back to English. */
const te = {
  common: {
    signOut: 'సైన్ అవుట్',
    language: 'భాష',
    markAllRead: 'అన్నీ చదివినవిగా గుర్తించు',
    save: 'భద్రపరచు',
    submit: 'సమర్పించు',
    close: 'మూసివేయి',
    refresh: 'రిఫ్రెష్',
    viewAll: 'అన్నీ చూడు',
    portalCitizen: 'పౌర పోర్టల్',
  },

  citizen: {
    portalEyebrow: 'పౌర పోర్టల్',
    nav: {
      dashboard: 'డాష్‌బోర్డ్',
      submit: 'ఫిర్యాదు దాఖలు',
      track: 'ఫిర్యాదు ట్రాక్',
      complaints: 'నా ఫిర్యాదులు',
      notifications: 'నోటిఫికేషన్‌లు',
      assistant: 'AI సహాయకుడు',
      profile: 'ప్రొఫైల్',
    },
    dashboard: {
      welcome: 'స్వాగతం',
      headerTrack: 'ట్రాక్',
      headerNew: 'కొత్త ఫిర్యాదు',
      stats: {
        totalFiled: 'మొత్తం దాఖలు',
        pending: 'పెండింగ్‌లో',
        resolved: 'పరిష్కరించబడింది',
        escalated: 'ఎస్కలేటెడ్',
      },
      quickActions: 'త్వరిత చర్యలు',
      action: {
        fileNew: 'కొత్త ఫిర్యాదు దాఖలు',
        track: 'ఫిర్యాదు ట్రాక్',
        assistant: 'AI సహాయకుడు',
        notifications: 'నోటిఫికేషన్‌లు',
      },
      recent: { title: 'ఇటీవలి కార్యకలాపాలు', empty: 'ఇంకా ఫిర్యాదులు లేవు' },
      insights: {
        title: 'AI అంతర్దృష్టులు',
        topCategory: 'ప్రధాన వర్గం',
        confidence: 'AI నమ్మకం',
        resolutionTitle: 'పరిష్కార రేటు',
      },
    },
    submit: {
      title: 'ఫిర్యాదు దాఖలు',
      fields: { title: 'ఫిర్యాదు శీర్షిక', description: 'వివరణ', category: 'వర్గం', location: 'స్థానం' },
      attachments: 'జతలు',
      attach: { photo: 'ఫోటో', video: 'వీడియో', audio: 'ఆడియో', record: 'రికార్డ్', stop: 'నిలిపివేయి' },
      cta: { submit: 'ఫిర్యాదు సమర్పించు' },
      ai: { title: 'AI విశ్లేషణ', analyze: 'AI తో విశ్లేషించండి' },
    },
    myComplaints: { title: 'నా ఫిర్యాదులు' },
    track: { title: 'ఫిర్యాదు ట్రాక్', cta: 'ట్రాక్' },
    notifications: { title: 'నోటిఫికేషన్‌లు' },
    profile: { title: 'నా ప్రొఫైల్' },
    assistant: { title: 'AI సహాయకుడు', send: 'పంపు' },
  },

  auth: {
    citizenLogin: { title: 'మళ్లీ స్వాగతం', cta: 'సైన్ ఇన్', email: 'ఇమెయిల్', password: 'పాస్‌వర్డ్' },
    signup: { title: 'ఖాతా సృష్టించండి', cta: 'ఖాతా సృష్టించండి' },
  },

  status: { submitted: 'సమర్పించబడింది', underReview: 'సమీక్షలో', assigned: 'కేటాయించబడింది', inProgress: 'ప్రగతిలో', resolved: 'పరిష్కరించబడింది' },
  priority: { low: 'తక్కువ', medium: 'మధ్యమ', high: 'ఎక్కువ', critical: 'క్రిటికల్' },
};

export default te;
