import { useMemo, useState, useEffect } from 'react';
import { X, Calendar, MapPin, Building2, Sparkles, Clock, ShieldAlert, Paperclip } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Complaint, useComplaints } from '../../contexts/ComplaintContext';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api/client';
import type { Attachment } from '@nivaran/shared';

interface ComplaintDetailsModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
  /** When 'admin', show the admin action panel below the AI Insights section. Defaults to 'citizen'. */
  mode?: 'citizen' | 'admin';
}

const STATUS_OPTIONS: Complaint['status'][] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
];

export default function ComplaintDetailsModal({
  complaint,
  isOpen,
  onClose,
  mode = 'citizen',
}: ComplaintDetailsModalProps) {
  // Subscribe to the live list so admin actions reflect immediately while
  // the modal stays open. Falls back to the prop if the cache hasn't caught
  // up yet (e.g. an optimistic prop passed by the parent before invalidation).
  const { complaints, updateComplaintStatus, updateComplaint, escalateComplaint, resolveComplaint } =
    useComplaints();

  const liveComplaint = useMemo(
    () => complaints.find((c) => c.id === complaint.id) ?? complaint,
    [complaints, complaint],
  );

  const [assigneeInput, setAssigneeInput] = useState(liveComplaint.assignee ?? '');

  // Load attachments for the open complaint. Only fires while the modal
  // is open, so background re-renders never refetch.
  const attachmentsQuery = useQuery<{ items: Attachment[] }>({
    queryKey: ['complaints', liveComplaint.id, 'attachments'],
    queryFn: () => apiClient.get<{ items: Attachment[] }>(`/complaints/${liveComplaint.id}/attachments`),
    enabled: isOpen,
  });
  const attachments = attachmentsQuery.data?.items ?? [];

  // Keep the input in sync if the modal is reopened against a different
  // complaint, or the assignee changes elsewhere (e.g. another admin panel).
  useEffect(() => {
    setAssigneeInput(liveComplaint.assignee ?? '');
  }, [liveComplaint.id, liveComplaint.assignee]);

  if (!isOpen) return null;

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'Critical': 'bg-[#EF4444] text-white',
      'High': 'bg-[#F59E0B] text-white',
      'Medium': 'bg-[#3B82F6] text-white',
      'Low': 'bg-[#6B7280] text-white',
    };
    return colors[priority] || 'bg-[#6B7280] text-white';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Submitted': 'bg-[#3B82F6] text-white',
      'Under Review': 'bg-[#F59E0B] text-white',
      'Assigned': 'bg-[#8B5CF6] text-white',
      'In Progress': 'bg-[#22C55E] text-white',
      'Resolved': 'bg-[#10B981] text-white',
    };
    return colors[status] || 'bg-[#6B7280] text-white';
  };

  const handleSaveAssignee = () => {
    const trimmed = assigneeInput.trim();
    // Only persist on actual change to avoid no-op writes.
    if (trimmed === (liveComplaint.assignee ?? '')) return;
    updateComplaint(liveComplaint.id, { assignee: trimmed || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="w-full max-w-2xl bg-white border-[#E5E7EB] shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] p-6 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-[#0B1220] mb-2">{liveComplaint.title}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-[#EEF2FF] text-[#2952E3] hover:bg-[#EEF2FF] text-xs">
                {liveComplaint.id}
              </Badge>
              <Badge className={`${getStatusColor(liveComplaint.status)} text-xs`}>
                {liveComplaint.status}
              </Badge>
              <Badge className={`${getPriorityColor(liveComplaint.priority)} text-xs`}>
                {liveComplaint.priority}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex-shrink-0 h-8 w-8 p-0 rounded-lg hover:bg-[#F8FAFC]"
          >
            <X className="w-5 h-5 text-[#6B7280]" strokeWidth={2} />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-[#0B1220] mb-2">Description</h3>
            <p className="text-sm text-[#6B7280] leading-relaxed">{liveComplaint.description}</p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                <div className="text-xs text-[#6B7280]">Category</div>
              </div>
              <div className="text-sm font-medium text-[#0B1220]">{liveComplaint.category}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                <div className="text-xs text-[#6B7280]">Department</div>
              </div>
              <div className="text-sm font-medium text-[#0B1220]">{liveComplaint.department}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                <div className="text-xs text-[#6B7280]">Filed Date</div>
              </div>
              <div className="text-sm font-medium text-[#0B1220]">{format(liveComplaint.submittedAt, 'MMM dd, yyyy')}</div>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                <div className="text-xs text-[#6B7280]">Est. Resolution</div>
              </div>
              <div className="text-sm font-medium text-[#0B1220]">{liveComplaint.estimatedResolution || 'N/A'}</div>
            </div>

            {liveComplaint.location && (
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] col-span-2">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                  <div className="text-xs text-[#6B7280]">Location</div>
                </div>
                <div className="text-sm font-medium text-[#0B1220]">{liveComplaint.location}</div>
              </div>
            )}
          </div>

          {/* Attachments — rendered only when the complaint has any. */}
          {attachments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Paperclip className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                <h3 className="text-sm font-semibold text-[#0B1220]">Attachments</h3>
                <span className="text-xs text-[#6B7280]">({attachments.length})</span>
              </div>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] overflow-hidden"
                  >
                    {a.kind === 'photo' && (
                      <a href={a.url} target="_blank" rel="noreferrer">
                        <img src={a.url} alt="Attachment" className="w-full h-24 object-cover" />
                      </a>
                    )}
                    {a.kind === 'video' && (
                      <video src={a.url} className="w-full h-24 object-cover" controls />
                    )}
                    {a.kind === 'audio' && (
                      <div className="h-24 flex items-center justify-center px-3">
                        <audio src={a.url} controls className="w-full" />
                      </div>
                    )}
                    <div className="px-2 py-1 text-[10px] text-[#6B7280] flex items-center justify-between bg-white border-t border-[#E5E7EB]">
                      <span className="capitalize">{a.kind}</span>
                      <span>{Math.round(a.sizeBytes / 1024)} KB</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Insights */}
          <div className="p-5 rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#F8FAFC] border border-[#DBEAFE]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#2952E3] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <h3 className="text-sm font-semibold text-[#0B1220]">AI Insights</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6B7280]">AI Confidence</span>
                <Badge className="bg-[#22C55E] text-white hover:bg-[#22C55E] text-xs">
                  {liveComplaint.aiConfidence}%
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#6B7280]">Sentiment</span>
                <span className="text-xs font-medium text-[#0B1220]">{liveComplaint.sentiment}</span>
              </div>
              <div>
                <div className="text-xs text-[#6B7280] mb-1.5">AI Summary</div>
                <p className="text-xs text-[#0B1220] leading-relaxed">{liveComplaint.aiSummary}</p>
              </div>
            </div>
          </div>

          {/* Admin Actions — only rendered when explicitly opted-in by the
              admin Complaints page. The citizen MyComplaints view never
              passes `mode`, so this section stays invisible there. */}
          {mode === 'admin' && (
            <div className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#0B1220] flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4 text-white" strokeWidth={2} />
                </div>
                <h3 className="text-sm font-semibold text-[#0B1220]">Admin Actions</h3>
              </div>

              <div className="space-y-4">
                {/* Status select */}
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1.5">Status</label>
                  <select
                    value={liveComplaint.status}
                    onChange={(e) =>
                      updateComplaintStatus(liveComplaint.id, e.target.value as Complaint['status'])
                    }
                    className="w-full h-10 px-3 border border-[#E5E7EB] rounded-xl bg-white text-[#0B1220] text-sm font-medium focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assign to officer */}
                <div>
                  <label className="block text-xs text-[#6B7280] mb-1.5">
                    Assign to officer
                    {liveComplaint.assignee && (
                      <span className="ml-2 text-[#0B1220]">
                        — current: <span className="font-medium">{liveComplaint.assignee}</span>
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={assigneeInput}
                      onChange={(e) => setAssigneeInput(e.target.value)}
                      placeholder={liveComplaint.assignee ?? 'Officer name or email'}
                      className="flex-1 h-10 px-3 border border-[#E5E7EB] rounded-xl bg-white text-[#0B1220] text-sm focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
                    />
                    <Button
                      onClick={handleSaveAssignee}
                      className="h-10 rounded-xl bg-[#2952E3] hover:bg-[#1F40C4] text-white px-4"
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {/* Escalate / Resolve */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => escalateComplaint(liveComplaint.id)}
                    disabled={liveComplaint.priority === 'Critical'}
                    className="h-10 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] text-white flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Escalate to Critical
                  </Button>
                  <Button
                    onClick={() => resolveComplaint(liveComplaint.id)}
                    disabled={liveComplaint.status === 'Resolved'}
                    className="h-10 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark as Resolved
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
