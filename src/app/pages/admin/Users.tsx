import { useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { UserPlus, Search, Loader2, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../../lib/api/client';
import { format } from 'date-fns';

type Role = 'citizen' | 'officer' | 'admin';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  city: string | null;
  role: Role;
  language: string;
  twoFactorEnabled: boolean;
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
}

interface UsersListResponse {
  items: AdminUser[];
  departments: { id: string; name: string }[];
}

const ROLE_BADGE: Record<Role, string> = {
  admin: 'bg-[#FEE2E2] text-[#EF4444]',
  officer: 'bg-[#EEF4FF] text-[#2F5BFF]',
  citizen: 'bg-[#F4F7FB] text-[#7C8AA5]',
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const usersQuery = useQuery<UsersListResponse>({
    queryKey: ['admin', 'users', search, roleFilter],
    queryFn: () =>
      apiClient.get<UsersListResponse>('/users', {
        query: {
          q: search.trim() || undefined,
          role: roleFilter === 'all' ? undefined : roleFilter,
        },
      }),
  });

  const items = usersQuery.data?.items ?? [];
  const departments = usersQuery.data?.departments ?? [];

  const inviteMutation = useMutation<
    { user: AdminUser },
    ApiError,
    { name: string; email: string; password: string; role: Role; departmentId: string | null }
  >({
    mutationFn: (input) => apiClient.post<{ user: AdminUser }>('/users', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowInvite(false);
    },
  });

  const updateMutation = useMutation<
    { user: AdminUser },
    ApiError,
    { id: string; name?: string; role?: Role; departmentId?: string | null }
  >({
    mutationFn: ({ id, ...patch }) => apiClient.patch<{ user: AdminUser }>(`/users/${id}`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setEditing(null);
    },
  });

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-1">User &amp; Role Management</h1>
            <p className="text-sm text-[#7C8AA5]">Invite officers, assign departments, and manage roles</p>
          </div>
          <Button
            onClick={() => setShowInvite(true)}
            className="bg-[#2F5BFF] hover:bg-[#2549D9] h-10 px-5 rounded-[14px] text-sm shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4 mr-2" strokeWidth={2} />
            Invite User
          </Button>
        </div>

        <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
          {/* Filters */}
          <div className="p-5 border-b border-[#E5EAF3] flex flex-wrap gap-3">
            <div className="flex-1 min-w-[180px] relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#7C8AA5]" strokeWidth={2} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-10 border-[#E5EAF3] h-10 rounded-[14px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-[#2F5BFF]"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | Role)}
              className="h-10 px-3.5 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm font-medium min-w-[150px] focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="officer">Officer</option>
              <option value="citizen">Citizen</option>
            </select>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="border-[#E5EAF3] bg-[#F8FAFC]">
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">User</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Role</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Department</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">2FA</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider">Joined</TableHead>
                <TableHead className="text-[#7C8AA5] text-[10px] font-semibold uppercase tracking-wider"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="w-5 h-5 mx-auto text-[#2F5BFF] animate-spin" strokeWidth={2} />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="text-sm text-[#7C8AA5]">No users match these filters</div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((u) => (
                  <TableRow key={u.id} className="border-[#E5EAF3]">
                    <TableCell>
                      <div className="text-sm font-medium text-[#0F172A]">{u.name}</div>
                      <div className="text-xs text-[#7C8AA5]">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${ROLE_BADGE[u.role]} text-xs capitalize hover:opacity-90`}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-[#0F172A]">{u.departmentName ?? '—'}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${u.twoFactorEnabled ? 'text-[#14B86A]' : 'text-[#7C8AA5]'}`}>
                        {u.twoFactorEnabled ? 'Enabled' : 'Off'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-[#7C8AA5]">{format(new Date(u.createdAt), 'MMM dd, yyyy')}</div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        onClick={() => setEditing(u)}
                        className="h-8 px-3 rounded-lg text-xs border-[#E5EAF3] text-[#0F172A] hover:bg-[#F8FAFC]"
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {showInvite && (
        <InviteUserModal
          departments={departments}
          isPending={inviteMutation.isPending}
          error={inviteMutation.error?.message ?? null}
          onClose={() => setShowInvite(false)}
          onSubmit={(values) => inviteMutation.mutate(values)}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          departments={departments}
          isPending={updateMutation.isPending}
          error={updateMutation.error?.message ?? null}
          onClose={() => setEditing(null)}
          onSubmit={(patch) => updateMutation.mutate({ id: editing.id, ...patch })}
        />
      )}
    </AdminLayout>
  );
}

interface InviteUserModalProps {
  departments: { id: string; name: string }[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: { name: string; email: string; password: string; role: Role; departmentId: string | null }) => void;
}

function InviteUserModal({ departments, isPending, error, onClose, onSubmit }: InviteUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('officer');
  const [departmentId, setDepartmentId] = useState<string>('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="w-full max-w-md bg-white border-[#E5EAF3] shadow-2xl rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#E5EAF3] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0F172A]">Invite User</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg hover:bg-[#F8FAFC]"
          >
            <X className="w-5 h-5 text-[#7C8AA5]" strokeWidth={2} />
          </Button>
        </div>
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name,
              email,
              password,
              role,
              departmentId: departmentId || null,
            });
          }}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#0F172A]">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-10 border-[#E5EAF3] rounded-[14px]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#0F172A]">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10 border-[#E5EAF3] rounded-[14px]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#0F172A]">Temporary password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="h-10 border-[#E5EAF3] rounded-[14px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#0F172A]">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-10 px-3 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="officer">Officer</option>
                <option value="admin">Admin</option>
                <option value="citizen">Citizen</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#0F172A]">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full h-10 px-3 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full h-10 bg-[#2F5BFF] hover:bg-[#2549D9] text-white rounded-[14px] disabled:opacity-60">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} /> : null}
            Send invite
          </Button>
        </form>
      </Card>
    </div>
  );
}

interface EditUserModalProps {
  user: AdminUser;
  departments: { id: string; name: string }[];
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (patch: { name?: string; role?: Role; departmentId?: string | null }) => void;
}

function EditUserModal({ user, departments, isPending, error, onClose, onSubmit }: EditUserModalProps) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [departmentId, setDepartmentId] = useState<string>(user.departmentId ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="w-full max-w-md bg-white border-[#E5EAF3] shadow-2xl rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#E5EAF3] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0F172A]">Edit User</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 rounded-lg hover:bg-[#F8FAFC]"
          >
            <X className="w-5 h-5 text-[#7C8AA5]" strokeWidth={2} />
          </Button>
        </div>
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const patch: { name?: string; role?: Role; departmentId?: string | null } = {};
            if (name !== user.name) patch.name = name;
            if (role !== user.role) patch.role = role;
            const dept = departmentId || null;
            if (dept !== (user.departmentId ?? null)) patch.departmentId = dept;
            onSubmit(patch);
          }}
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#0F172A]">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="h-10 border-[#E5EAF3] rounded-[14px]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#0F172A]">Email</label>
            <Input value={user.email} disabled className="h-10 border-[#E5EAF3] rounded-[14px] bg-[#F8FAFC]" />
            <p className="text-[10px] text-[#7C8AA5]">Email cannot be changed</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#0F172A]">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-10 px-3 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="citizen">Citizen</option>
                <option value="officer">Officer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#0F172A]">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full h-10 px-3 border border-[#E5EAF3] rounded-[14px] bg-white text-[#0F172A] text-sm focus:ring-2 focus:ring-[#2F5BFF] focus:border-transparent"
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-[#EF4444]">{error}</p>}
          <Button type="submit" disabled={isPending} className="w-full h-10 bg-[#2F5BFF] hover:bg-[#2549D9] text-white rounded-[14px] disabled:opacity-60">
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} /> : null}
            Save changes
          </Button>
        </form>
      </Card>
    </div>
  );
}
