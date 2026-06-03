// Shared status/priority badge color helpers.
//
// The mappings here are copied verbatim from the citizen-side
// `src/app/pages/citizen/MyComplaints.tsx` so the admin and citizen UIs
// render identical badges. Keep the two in sync if either palette changes.

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Submitted': 'bg-[#3B82F6] text-white hover:bg-[#3B82F6]',
    'Under Review': 'bg-[#F59E0B] text-white hover:bg-[#F59E0B]',
    'Assigned': 'bg-[#8B5CF6] text-white hover:bg-[#8B5CF6]',
    'In Progress': 'bg-[#22C55E] text-white hover:bg-[#22C55E]',
    'Resolved': 'bg-[#10B981] text-white hover:bg-[#10B981]',
  };
  return colors[status] ?? 'bg-[#6B7280] text-white';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    'Critical': 'bg-[#EF4444] text-white hover:bg-[#EF4444]',
    'High': 'bg-[#F59E0B] text-white hover:bg-[#F59E0B]',
    'Medium': 'bg-[#3B82F6] text-white hover:bg-[#3B82F6]',
    'Low': 'bg-[#6B7280] text-white hover:bg-[#6B7280]',
  };
  return colors[priority] ?? 'bg-[#6B7280] text-white';
}
