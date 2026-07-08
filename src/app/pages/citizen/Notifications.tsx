import CitizenLayout from '../../components/layouts/CitizenLayout';
import { Bell, CheckCircle2, AlertCircle, FileText, Clock } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useComplaints } from '../../contexts/ComplaintContext';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';

export default function Notifications() {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead } = useComplaints();
  const { t } = useTranslation(['citizen', 'common']);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'submitted':
        return <CheckCircle2 className="w-5 h-5 text-[#22C55E]" strokeWidth={2} />;
      case 'status_updated':
        return <Clock className="w-5 h-5 text-[#3B82F6]" strokeWidth={2} />;
      case 'resolved':
        return <CheckCircle2 className="w-5 h-5 text-[#10B981]" strokeWidth={2} />;
      case 'escalated':
        return <AlertCircle className="w-5 h-5 text-[#EF4444]" strokeWidth={2} />;
      default:
        return <FileText className="w-5 h-5 text-[#6B7280]" strokeWidth={2} />;
    }
  };

  const getNotificationBg = (type: string) => {
    switch (type) {
      case 'submitted':
        return 'bg-[#DCFCE7]';
      case 'status_updated':
        return 'bg-[#DBEAFE]';
      case 'resolved':
        return 'bg-[#D1FAE5]';
      case 'escalated':
        return 'bg-[#FEE2E2]';
      default:
        return 'bg-[#F8FAFC]';
    }
  };

  return (
    <CitizenLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold mb-1">{t('common:portalCitizen').toUpperCase()}</div>
            <h1 className="text-3xl font-bold text-[#0B1220] mb-2">{t('citizen:notifications.title')}</h1>
            <p className="text-sm text-[#6B7280]">{t('citizen:notifications.subtitle', { defaultValue: 'Stay updated on your complaint status and important alerts' })}</p>
          </div>
          {notifications.some((n) => !n.read) && (
            <button
              type="button"
              onClick={markAllNotificationsAsRead}
              className="flex-shrink-0 mt-1 inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-[#E5E7EB] bg-white text-[#2952E3] hover:bg-[#EEF2FF] transition-colors text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              {t('common:markAllRead')}
            </button>
          )}
        </div>

        {/* Notifications Card */}
        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-20 h-20 rounded-full bg-[#FEF3C7] flex items-center justify-center mb-4">
                <Bell className="w-10 h-10 text-[#F59E0B]" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg font-semibold text-[#0B1220] mb-2">No notifications yet</h2>
              <p className="text-sm text-[#6B7280] text-center max-w-md">
                You'll receive real-time updates about your complaints, status changes, and important alerts here
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => markNotificationAsRead(notification.id)}
                  className={`p-5 flex items-start gap-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                    !notification.read ? 'bg-[#F8FAFC]' : ''
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl ${getNotificationBg(notification.type)} flex items-center justify-center flex-shrink-0`}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-sm text-[#0B1220] leading-relaxed">{notification.message}</p>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-[#2952E3] flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                      <span>{formatDistanceToNow(notification.timestamp, { addSuffix: true })}</span>
                      <span>•</span>
                      <Badge className="bg-[#EEF2FF] text-[#2952E3] hover:bg-[#EEF2FF] text-[10px] px-2 py-0">
                        {notification.complaintId}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </CitizenLayout>
  );
}
