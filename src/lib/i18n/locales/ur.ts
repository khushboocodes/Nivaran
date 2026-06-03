/** Urdu — partial. Note: rendered RTL by the browser when the html dir is set;
 *  we don't override layout, just translate strings. */
const ur = {
  common: {
    signOut: 'سائن آؤٹ',
    language: 'زبان',
    markAllRead: 'سب کو پڑھا ہوا نشان زد کریں',
    save: 'محفوظ کریں',
    submit: 'جمع کرائیں',
    close: 'بند کریں',
    refresh: 'ریفریش',
    viewAll: 'سب دیکھیں',
    portalCitizen: 'شہری پورٹل',
  },
  citizen: {
    portalEyebrow: 'شہری پورٹل',
    nav: {
      dashboard: 'ڈیش بورڈ',
      submit: 'شکایت درج کریں',
      track: 'شکایت ٹریک',
      complaints: 'میری شکایات',
      notifications: 'اطلاعات',
      assistant: 'AI معاون',
      profile: 'پروفائل',
    },
    dashboard: {
      welcome: 'خوش آمدید',
      headerTrack: 'ٹریک',
      headerNew: 'نئی شکایت',
      stats: {
        totalFiled: 'کل درج',
        pending: 'زیر التوا',
        resolved: 'حل شدہ',
        escalated: 'بڑھایا گیا',
      },
      quickActions: 'فوری اعمال',
      action: {
        fileNew: 'نئی شکایت درج',
        track: 'شکایت ٹریک',
        assistant: 'AI معاون',
        notifications: 'اطلاعات',
      },
      recent: { title: 'حالیہ سرگرمی', empty: 'ابھی تک کوئی شکایت نہیں' },
      insights: { title: 'AI بصیرت', topCategory: 'سرفہرست زمرہ', confidence: 'AI اعتماد', resolutionTitle: 'حل کی شرح' },
    },
    submit: {
      title: 'شکایت درج کریں',
      fields: { title: 'شکایت عنوان', description: 'تفصیل', category: 'زمرہ', location: 'مقام' },
      attachments: 'منسلکات',
      attach: { photo: 'تصویر', video: 'ویڈیو', audio: 'آڈیو', record: 'ریکارڈ', stop: 'روکیں' },
      cta: { submit: 'شکایت جمع کرائیں' },
      ai: { title: 'AI تجزیہ', analyze: 'AI سے تجزیہ کریں' },
    },
    myComplaints: { title: 'میری شکایات' },
    track: { title: 'شکایت ٹریک', cta: 'ٹریک' },
    notifications: { title: 'اطلاعات' },
    profile: { title: 'میری پروفائل' },
    assistant: { title: 'AI معاون', send: 'بھیجیں' },
  },
  auth: {
    citizenLogin: { title: 'دوبارہ خوش آمدید', cta: 'سائن ان', email: 'ای میل', password: 'پاس ورڈ' },
    signup: { title: 'اکاؤنٹ بنائیں', cta: 'اکاؤنٹ بنائیں' },
  },
  status: { submitted: 'جمع', underReview: 'زیر جائزہ', assigned: 'تفویض', inProgress: 'جاری', resolved: 'حل شدہ' },
  priority: { low: 'کم', medium: 'درمیانہ', high: 'زیادہ', critical: 'نازک' },
};
export default ur;
