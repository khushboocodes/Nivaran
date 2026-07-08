import { useEffect, useState } from 'react';
import AdminLayout from '../../components/layouts/AdminLayout';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Zap, Shield, Bell, Settings2, Save, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../../lib/api/client';
import type { Settings } from '@nivaran/shared';

const DEFAULT_SETTINGS: Settings = {
  ai: { autoClassify: true, sentiment: true },
  escalation: { autoEscalateCritical: true, escalateAfterDays: 7 },
  notifications: { email: true, sms: false, publicDashboard: false },
  general: { maxComplaintsPerUser: 10, defaultDepartment: 'Municipal Corporation' },
};

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => apiClient.get<Settings>('/settings'),
  });

  // Local form state — initialized once the GET resolves, then edited
  // freely until the citizen hits Save.
  const [form, setForm] = useState<Settings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settingsQuery.data && !dirty) setForm(settingsQuery.data);
    // We intentionally only seed when not dirty so concurrent refetches
    // don't blow away the citizen's in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data]);

  const saveMutation = useMutation<Settings, ApiError, Settings>({
    mutationFn: (next) => apiClient.put<Settings>('/settings', next),
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      setDirty(false);
    },
  });

  const update = <K extends keyof Settings, F extends keyof Settings[K]>(
    section: K,
    field: F,
    value: Settings[K][F],
  ) => {
    setDirty(true);
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const isLoading = settingsQuery.isLoading;
  const isSaving = saveMutation.isPending;

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-1">Settings</h1>
          <p className="text-sm text-[#7C8AA5]">Configure the NIVARAN platform</p>
        </div>

        <div className="max-w-[960px] space-y-6">
          {/* AI Configuration */}
          <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5EAF3]">
              <div className="w-9 h-9 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                <Zap className="w-[18px] h-[18px] text-[#2F5BFF]" strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-[#0F172A] text-sm">AI Configuration</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">Auto Classification</div>
                  <div className="text-xs text-[#7C8AA5]">Automatically classify complaints using AI</div>
                </div>
                <Switch
                  checked={form.ai.autoClassify}
                  disabled={isLoading}
                  onCheckedChange={(v) => update('ai', 'autoClassify', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">Sentiment Analysis</div>
                  <div className="text-xs text-[#7C8AA5]">Analyze citizen sentiment on complaints</div>
                </div>
                <Switch
                  checked={form.ai.sentiment}
                  disabled={isLoading}
                  onCheckedChange={(v) => update('ai', 'sentiment', v)}
                />
              </div>
            </div>
          </Card>

          {/* Escalation Rules */}
          <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5EAF3]">
              <div className="w-9 h-9 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                <Shield className="w-[18px] h-[18px] text-[#EF4444]" strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-[#0F172A] text-sm">Escalation Rules</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">Auto-Escalate Critical</div>
                  <div className="text-xs text-[#7C8AA5]">Escalate critical priority complaints automatically</div>
                </div>
                <Switch
                  checked={form.escalation.autoEscalateCritical}
                  disabled={isLoading}
                  onCheckedChange={(v) => update('escalation', 'autoEscalateCritical', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">Auto-escalate after (days)</div>
                  <div className="text-xs text-[#7C8AA5]">Unresolved complaints escalated after N days</div>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.escalation.escalateAfterDays}
                  disabled={isLoading}
                  onChange={(e) =>
                    update(
                      'escalation',
                      'escalateAfterDays',
                      Math.max(1, Math.min(365, Number(e.target.value) || 1)),
                    )
                  }
                  className="w-20 h-9 text-center border-[#E5EAF3] rounded-lg"
                />
              </div>
            </div>
          </Card>

          {/* Notifications */}
          <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5EAF3]">
              <div className="w-9 h-9 rounded-lg bg-[#FEF6E6] flex items-center justify-center">
                <Bell className="w-[18px] h-[18px] text-[#F5A524]" strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-[#0F172A] text-sm">Notifications</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">Email Notifications</div>
                  <div className="text-xs text-[#7C8AA5]">Send email updates to citizens on status changes</div>
                </div>
                <Switch
                  checked={form.notifications.email}
                  disabled={isLoading}
                  onCheckedChange={(v) => update('notifications', 'email', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">Public Dashboard</div>
                  <div className="text-xs text-[#7C8AA5]">Allow citizens to view aggregate complaint stats</div>
                </div>
                <Switch
                  checked={form.notifications.publicDashboard}
                  disabled={isLoading}
                  onCheckedChange={(v) => update('notifications', 'publicDashboard', v)}
                />
              </div>
            </div>
          </Card>

          {/* General */}
          <Card className="border-[#E5EAF3] rounded-[20px] bg-white" style={{boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)'}}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-[#E5EAF3]">
              <div className="w-9 h-9 rounded-lg bg-[#F4F4F5] flex items-center justify-center">
                <Settings2 className="w-[18px] h-[18px] text-[#64748B]" strokeWidth={2} />
              </div>
              <h3 className="font-semibold text-[#0F172A] text-sm">General</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">Max Complaints per User</div>
                  <div className="text-xs text-[#7C8AA5]">Monthly limit per citizen</div>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={form.general.maxComplaintsPerUser}
                  disabled={isLoading}
                  onChange={(e) =>
                    update(
                      'general',
                      'maxComplaintsPerUser',
                      Math.max(1, Number(e.target.value) || 1),
                    )
                  }
                  className="w-20 h-9 text-center border-[#E5EAF3] rounded-lg"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#0F172A] mb-0.5">Default Department</div>
                  <div className="text-xs text-[#7C8AA5]">Fallback for unclassified complaints</div>
                </div>
                <Input
                  value={form.general.defaultDepartment}
                  disabled={isLoading}
                  onChange={(e) => update('general', 'defaultDepartment', e.target.value)}
                  className="w-56 h-9 border-[#E5EAF3] rounded-lg text-sm"
                />
              </div>
            </div>
          </Card>

          {/* Save Button */}
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={isLoading || isSaving || !dirty}
            className="w-full bg-[#2F5BFF] hover:bg-[#2549D9] h-[52px] rounded-[14px] text-sm font-medium shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
                Saving…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" strokeWidth={2} />
                {dirty ? 'Save Settings' : 'Saved'}
              </>
            )}
          </Button>

          {saveMutation.isError && (
            <p className="text-xs text-[#EF4444] text-center">
              Could not save settings. Please try again.
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
