import { useMemo, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Search } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useComplaints, type Complaint } from '../../contexts/ComplaintContext';
import { useScopedComplaints } from '../../contexts/DepartmentScopeContext';
import { getStatusColor, getPriorityColor } from '../../../lib/badge-colors';
import ComplaintDetailsModal from '../../components/modals/ComplaintDetailsModal';
import { format } from 'date-fns';

// Map kebab-case <select> values to the canonical `Complaint` enum values.
const STATUS_FROM_OPTION: Record<string, Complaint['status']> = {
  'submitted': 'Submitted',
  'under-review': 'Under Review',
  'assigned': 'Assigned',
  'in-progress': 'In Progress',
  'resolved': 'Resolved',
};

const PRIORITY_FROM_OPTION: Record<string, Complaint['priority']> = {
  'low': 'Low',
  'medium': 'Medium',
  'high': 'High',
  'critical': 'Critical',
};

export default function AdminComplaints() {
  const { complaints: allComplaints } = useComplaints();
  const complaints = useScopedComplaints(allComplaints);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all-status');
  const [priorityFilter, setPriorityFilter] = useState('all-priority');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const filteredComplaints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return complaints.filter((c) => {
      const matchesSearch =
        q === '' ||
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q);

      // 'escalated' isn't a real status — the context models escalation via
      // `priority === 'Critical'`. Treat the filter accordingly.
      const matchesStatus =
        statusFilter === 'all-status' ||
        (statusFilter === 'escalated'
          ? c.priority === 'Critical'
          : c.status === STATUS_FROM_OPTION[statusFilter]);

      const matchesPriority =
        priorityFilter === 'all-priority' ||
        c.priority === PRIORITY_FROM_OPTION[priorityFilter];

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [complaints, searchQuery, statusFilter, priorityFilter]);

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Complaints Management</h1>
          <p className="text-sm text-[#7C8AA5]">Review, assign, and resolve citizen complaints</p>
        </div>

        <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          {/* Search & Filters */}
          <div className="p-5 border-b border-[#E5EAF3]">
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[180px] relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#7C8AA5]" strokeWidth={2} />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search complaints..."
                  className="pl-10 border-[#E5EAF3] h-10 rounded-[14px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-[#2F5BFF]"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm font-medium min-w-[150px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="all-status">All Status</option>
                <option value="submitted">Submitted</option>
                <option value="under-review">Under Review</option>
                <option value="assigned">Assigned</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 px-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm font-medium min-w-[150px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="all-priority">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="border-[#E5EAF3] bg-[#F8FAFC]">
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Complaint</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Category</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Priority</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Citizen</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Filed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredComplaints.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-56 text-center">
                    <div className="text-sm text-[#7C8AA5]">
                      {complaints.length === 0
                        ? 'No complaints found'
                        : 'No complaints match your filters'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredComplaints.map((c) => (
                  <TableRow key={c.id} onClick={() => setSelectedComplaint(c)} className="border-[#E5EAF3] cursor-pointer">
                    <TableCell>
                      <div className="text-sm font-medium text-[#0F172A]">{c.title}</div>
                      <div className="text-xs text-[#7C8AA5]">{c.id} • {c.department}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-[#0F172A]">{c.category}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(c.status)} text-xs`}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getPriorityColor(c.priority)} text-xs`}>
                        {c.priority}
                      </Badge>
                    </TableCell>
                    {/* TODO: replace once auth lands */}
                    <TableCell>
                      <div className="text-sm text-[#0F172A]">You</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-[#7C8AA5]">{format(c.submittedAt, 'MMM dd, yyyy')}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Complaint Details Modal */}
      {selectedComplaint && (
        <ComplaintDetailsModal
          complaint={selectedComplaint}
          isOpen={!!selectedComplaint}
          onClose={() => setSelectedComplaint(null)}
          mode="admin"
        />
      )}
    </AdminLayout>
  );
}
