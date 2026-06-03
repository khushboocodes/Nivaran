import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { Download, Search, RefreshCw } from 'lucide-react';
import { apiClient } from '../../../lib/api/client';
import { format } from 'date-fns';

interface AuditRow {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  at: string;
}

interface AuditResponse {
  items: AuditRow[];
  page: number;
  pageSize: number;
  total: number;
}

export default function AdminAudit() {
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const [entityId, setEntityId] = useState('');

  const query = useQuery<AuditResponse>({
    queryKey: ['audit', { entity, action, entityId }],
    queryFn: () => apiClient.get<AuditResponse>('/audit', {
      query: {
        entity: entity || undefined,
        action: action || undefined,
        entityId: entityId || undefined,
        pageSize: 100,
      },
    }),
  });

  const onExport = () => {
    const params = new URLSearchParams();
    params.set('format', 'csv');
    if (entity) params.set('entity', entity);
    if (action) params.set('action', action);
    if (entityId) params.set('entityId', entityId);
    const url = `/api/audit?${params.toString()}`;
    // The browser handles the download via the Content-Disposition header.
    window.location.href = url;
  };

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Audit Log</h1>
            <p className="text-sm text-[#7C8AA5]">Every mutation in the system, with actor, entity, and before/after.</p>
          </div>
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              onClick={() => query.refetch()}
              className="border-[#E5EAF3] h-9 px-4 rounded-[14px] text-sm hover:border-[#2F5BFF] hover:text-[#2F5BFF] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Refresh
            </Button>
            <Button
              onClick={onExport}
              className="bg-[#2F5BFF] hover:bg-[#2549D9] h-9 px-4 rounded-[14px] text-sm shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={2} />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-[#E5EAF3] rounded-[20px] bg-white mb-5" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          <div className="p-5 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#7C8AA5]" strokeWidth={2} />
              <Input
                placeholder="Filter by entity (e.g. complaint)"
                value={entity}
                onChange={(e) => setEntity(e.target.value)}
                className="pl-10 border-[#E5EAF3] h-10 rounded-[14px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-[#2F5BFF]"
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="Filter by action (e.g. complaint.update)"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="border-[#E5EAF3] h-10 rounded-[14px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-[#2F5BFF]"
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="Filter by entity id"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                className="border-[#E5EAF3] h-10 rounded-[14px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-[#2F5BFF]"
              />
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          <Table>
            <TableHeader>
              <TableRow className="border-[#E5EAF3] bg-[#F8FAFC]">
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">When</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Action</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Entity</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Entity ID</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="text-sm text-[#7C8AA5]">Loading audit log…</div>
                  </TableCell>
                </TableRow>
              ) : query.data && query.data.items.length > 0 ? (
                query.data.items.map((row) => (
                  <TableRow key={row.id} className="border-[#E5EAF3]">
                    <TableCell>
                      <div className="text-xs text-[#0F172A] font-mono">{format(new Date(row.at), 'MMM dd, HH:mm:ss')}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-[#EEF4FF] text-[#2F5BFF] hover:bg-[#EEF4FF] text-xs font-mono">
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-[#0F172A]">{row.entity}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-[#7C8AA5] font-mono truncate max-w-[200px]" title={row.entityId}>{row.entityId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-[#7C8AA5] font-mono truncate max-w-[200px]" title={row.actorId}>{row.actorId}</div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="text-sm text-[#7C8AA5]">No audit rows match your filters.</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        {query.data && (
          <div className="mt-4 text-xs text-[#7C8AA5] text-right">
            Showing {query.data.items.length} of {query.data.total} rows.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
