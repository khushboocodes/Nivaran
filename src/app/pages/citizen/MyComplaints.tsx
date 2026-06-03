import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import CitizenLayout from '../../components/layouts/CitizenLayout';
import { Search, FileText, Filter, AlertCircle, Star } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useComplaints } from '../../contexts/ComplaintContext';
import ComplaintDetailsModal from '../../components/modals/ComplaintDetailsModal';
import FeedbackModal from '../../components/modals/FeedbackModal';
import { useMyFeedbackQuery } from '../../../lib/api/hooks';
import { format } from 'date-fns';

export default function MyComplaints() {
  const { t } = useTranslation(['citizen', 'common', 'status']);
  const { complaints } = useComplaints();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState<typeof complaints[0] | null>(null);
  const feedbackQuery = useMyFeedbackQuery();
  const ratedComplaintIds = new Set(feedbackQuery.data?.map((f) => f.complaintId) ?? []);
  const [feedbackTarget, setFeedbackTarget] = useState<{ id: string; title: string } | null>(null);

  const filteredComplaints = complaints.filter(complaint => {
    const matchesSearch = complaint.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         complaint.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'pending' && (complaint.status === 'Submitted' || complaint.status === 'Under Review')) ||
                         (statusFilter === 'resolved' && complaint.status === 'Resolved') ||
                         (statusFilter === 'escalated' && complaint.priority === 'Critical');
    return matchesSearch && matchesStatus;
  });

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'Critical': 'bg-[#EF4444] text-white hover:bg-[#EF4444]',
      'High': 'bg-[#F59E0B] text-white hover:bg-[#F59E0B]',
      'Medium': 'bg-[#3B82F6] text-white hover:bg-[#3B82F6]',
      'Low': 'bg-[#6B7280] text-white hover:bg-[#6B7280]',
    };
    return colors[priority] || 'bg-[#6B7280] text-white';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Submitted': 'bg-[#3B82F6] text-white hover:bg-[#3B82F6]',
      'Under Review': 'bg-[#F59E0B] text-white hover:bg-[#F59E0B]',
      'Assigned': 'bg-[#8B5CF6] text-white hover:bg-[#8B5CF6]',
      'In Progress': 'bg-[#22C55E] text-white hover:bg-[#22C55E]',
      'Resolved': 'bg-[#10B981] text-white hover:bg-[#10B981]',
    };
    return colors[status] || 'bg-[#6B7280] text-white';
  };

  return (
    <CitizenLayout>
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold mb-1">
            {t('common:portalCitizen').toUpperCase()}
          </div>
          <h1 className="text-3xl font-bold text-[#0B1220] mb-2">{t('citizen:myComplaints.title')}</h1>
          <p className="text-sm text-[#6B7280]">{t('citizen:myComplaints.subtitle', { defaultValue: 'View and manage all your submitted complaints' })}</p>
        </div>

        <Card className="border-[#E5E7EB] bg-white shadow-sm">
          {/* Search & Filters */}
          <div className="p-5 border-b border-[#E5E7EB]">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search complaints..."
                  className="pl-10 h-11 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 px-4 border border-[#E5E7EB] rounded-xl bg-white text-[#0B1220] focus:ring-2 focus:ring-[#2952E3] focus:border-transparent text-sm font-medium min-w-[160px]"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
              </select>
              <Button variant="outline" className="h-11 border-[#E5E7EB] rounded-xl px-4">
                <Filter className="w-4 h-4 mr-2" strokeWidth={2} />
                Filter
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                <tr>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">{t('citizen:myComplaints.table.complaint', { defaultValue: 'Complaint' })}</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">{t('citizen:myComplaints.table.category', { defaultValue: 'Category' })}</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">{t('citizen:myComplaints.table.status', { defaultValue: 'Status' })}</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">{t('citizen:myComplaints.table.priority', { defaultValue: 'Priority' })}</th>
                  <th className="px-5 py-3.5 text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">{t('citizen:myComplaints.table.filed', { defaultValue: 'Filed' })}</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-96">
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="w-20 h-20 rounded-full bg-[#F8FAFC] flex items-center justify-center mb-4">
                          <FileText className="w-10 h-10 text-[#6B7280]" strokeWidth={1.5} />
                        </div>
                        <div className="text-sm text-[#0B1220] font-medium mb-1">
                          {complaints.length === 0 ? 'No complaints filed yet' : 'No complaints match your filters'}
                        </div>
                        <div className="text-xs text-[#6B7280] mb-4">
                          {complaints.length === 0 ? 'File your first complaint to get started' : 'Try adjusting your search or filters'}
                        </div>
                        {complaints.length === 0 && (
                          <Link to="/citizen/submit">
                            <Button className="bg-[#2952E3] hover:bg-[#1e3a8a] h-10 rounded-xl">
                              File New Complaint
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredComplaints.map(complaint => (
                    <tr
                      key={complaint.id}
                      onClick={() => setSelectedComplaint(complaint)}
                      className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-5 h-5 text-[#2952E3]" strokeWidth={2} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-[#0B1220] text-sm mb-0.5 truncate">{complaint.title}</div>
                            <div className="text-xs text-[#6B7280]">{complaint.id} • {complaint.department}</div>
                          </div>
                          {complaint.status === 'Resolved' && !ratedComplaintIds.has(complaint.id) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFeedbackTarget({ id: complaint.id, title: complaint.title });
                              }}
                              className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#B45309] hover:bg-[#FDE68A] transition-colors text-[11px] font-medium"
                            >
                              <Star className="w-3 h-3" strokeWidth={2} />
                              Rate
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-[#0B1220]">{complaint.category}</div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={`${getStatusColor(complaint.status)} text-xs`}>
                          {complaint.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge className={`${getPriorityColor(complaint.priority)} text-xs`}>
                          {complaint.priority}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-[#6B7280]">{format(complaint.submittedAt, 'MMM dd, yyyy')}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Complaint Details Modal */}
      {selectedComplaint && (
        <ComplaintDetailsModal
          complaint={selectedComplaint}
          isOpen={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
        />
      )}

      {/* Feedback Modal */}
      {feedbackTarget && (
        <FeedbackModal
          complaintId={feedbackTarget.id}
          complaintTitle={feedbackTarget.title}
          isOpen={!!feedbackTarget}
          onClose={() => setFeedbackTarget(null)}
        />
      )}
    </CitizenLayout>
  );
}
