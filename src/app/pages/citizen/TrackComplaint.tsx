import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CitizenLayout from '../../components/layouts/CitizenLayout';
import { Search, FileSearch, AlertCircle, Calendar, Building2, MapPin, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useComplaints } from '../../contexts/ComplaintContext';
import StatusTimeline from '../../components/StatusTimeline';
import { format } from 'date-fns';

export default function TrackComplaint() {
  const { t } = useTranslation(['citizen', 'common']);
  const { getComplaintById } = useComplaints();
  const [complaintId, setComplaintId] = useState('');
  const [searchedComplaint, setSearchedComplaint] = useState<ReturnType<typeof getComplaintById>>(undefined);
  const [notFound, setNotFound] = useState(false);

  const handleSearch = () => {
    if (!complaintId.trim()) {
      return;
    }

    const complaint = getComplaintById(complaintId.trim());
    if (complaint) {
      setSearchedComplaint(complaint);
      setNotFound(false);
    } else {
      setSearchedComplaint(undefined);
      setNotFound(true);
    }
  };

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
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold mb-1">{t('common:portalCitizen').toUpperCase()}</div>
          <h1 className="text-3xl font-bold text-[#0B1220] mb-2">{t('citizen:track.title')}</h1>
          <p className="text-sm text-[#6B7280]">{t('citizen:track.subtitle', { defaultValue: 'Search and track your complaint status in real-time' })}</p>
        </div>

        {/* Search Card */}
        <Card className="p-8 border-[#E5E7EB] bg-white shadow-sm">
          <div className="flex flex-col items-center justify-center text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[#EEF2FF] flex items-center justify-center mb-4">
              <FileSearch className="w-8 h-8 text-[#2952E3]" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-semibold text-[#0B1220] mb-2">Enter Your Complaint ID</h2>
            <p className="text-sm text-[#6B7280]">Your complaint ID was sent to your email after submission</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="flex gap-3">
              <Input
                id="complaintId"
                value={complaintId}
                onChange={(e) => setComplaintId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter your complaint ID (e.g., CMP123456)"
                className="h-12 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent text-center"
              />
              <Button onClick={handleSearch} className="bg-[#2952E3] hover:bg-[#1e3a8a] h-12 px-8 rounded-xl">
                <Search className="w-4 h-4 mr-2" strokeWidth={2} />
                {t('citizen:track.cta', { defaultValue: 'Track' })}
              </Button>
            </div>

            <div className="mt-6 p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
              <div className="text-xs text-[#6B7280] text-center">
                <span className="font-medium text-[#0B1220]">Tip:</span> You can also track complaints using your registered email address or phone number
              </div>
            </div>
          </div>
        </Card>

        {/* Not Found Message */}
        {notFound && !searchedComplaint && (
          <Card className="p-8 border-[#E5E7EB] bg-white shadow-sm mt-6">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#FEE2E2] flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-[#EF4444]" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-[#0B1220] mb-2">Complaint Not Found</h3>
              <p className="text-sm text-[#6B7280]">
                No complaint found with ID: <span className="font-medium text-[#0B1220]">{complaintId}</span>
              </p>
              <p className="text-xs text-[#6B7280] mt-2">Please check the ID and try again</p>
            </div>
          </Card>
        )}

        {/* Complaint Details */}
        {searchedComplaint && (
          <div className="space-y-6 mt-6">
            {/* Complaint Info Card */}
            <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[#0B1220] mb-3">{searchedComplaint.title}</h2>
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    <Badge className="bg-[#EEF2FF] text-[#2952E3] hover:bg-[#EEF2FF] text-xs">
                      {searchedComplaint.id}
                    </Badge>
                    <Badge className={`${getStatusColor(searchedComplaint.status)} text-xs`}>
                      {searchedComplaint.status}
                    </Badge>
                    <Badge className={`${getPriorityColor(searchedComplaint.priority)} text-xs`}>
                      {searchedComplaint.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-[#6B7280] leading-relaxed">{searchedComplaint.description}</p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                    <div className="text-xs text-[#6B7280]">Category</div>
                  </div>
                  <div className="text-sm font-medium text-[#0B1220]">{searchedComplaint.category}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                    <div className="text-xs text-[#6B7280]">Department</div>
                  </div>
                  <div className="text-sm font-medium text-[#0B1220]">{searchedComplaint.department}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                    <div className="text-xs text-[#6B7280]">Filed Date</div>
                  </div>
                  <div className="text-sm font-medium text-[#0B1220]">{format(searchedComplaint.submittedAt, 'MMM dd, yyyy')}</div>
                </div>

                <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB]">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                    <div className="text-xs text-[#6B7280]">Est. Resolution</div>
                  </div>
                  <div className="text-sm font-medium text-[#0B1220]">{searchedComplaint.estimatedResolution || 'N/A'}</div>
                </div>

                {searchedComplaint.location && (
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-[#6B7280]" strokeWidth={2} />
                      <div className="text-xs text-[#6B7280]">Location</div>
                    </div>
                    <div className="text-sm font-medium text-[#0B1220]">{searchedComplaint.location}</div>
                  </div>
                )}
              </div>
            </Card>

            {/* Status Timeline Card */}
            <Card className="p-6 border-[#E5E7EB] bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-[#0B1220] mb-6">Status Timeline</h3>
              <StatusTimeline currentStatus={searchedComplaint.status} />
            </Card>
          </div>
        )}
      </div>
    </CitizenLayout>
  );
}
