import { CheckCircle2, Circle } from 'lucide-react';

interface TimelineStep {
  status: string;
  title: string;
  description: string;
}

interface StatusTimelineProps {
  currentStatus: string;
}

const timelineSteps: TimelineStep[] = [
  { status: 'Submitted', title: 'Submitted', description: 'Complaint received and logged' },
  { status: 'Under Review', title: 'Under Review', description: 'Being reviewed by officials' },
  { status: 'Assigned', title: 'Assigned', description: 'Assigned to department' },
  { status: 'In Progress', title: 'In Progress', description: 'Actively being worked on' },
  { status: 'Resolved', title: 'Resolved', description: 'Issue successfully resolved' },
];

export default function StatusTimeline({ currentStatus }: StatusTimelineProps) {
  const currentIndex = timelineSteps.findIndex(step => step.status === currentStatus);

  return (
    <div className="space-y-0">
      {timelineSteps.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.status} className="relative flex gap-4">
            {/* Timeline Line */}
            {index < timelineSteps.length - 1 && (
              <div className="absolute left-[15px] top-8 w-[2px] h-[calc(100%-8px)] bg-[#E5E7EB]">
                {isCompleted && (
                  <div className="w-full bg-[#2952E3] transition-all duration-500" style={{ height: '100%' }} />
                )}
              </div>
            )}

            {/* Icon */}
            <div className="flex-shrink-0 pt-1">
              {isCompleted ? (
                <div className={`w-8 h-8 rounded-full ${isCurrent ? 'bg-[#2952E3]' : 'bg-[#2952E3]'} flex items-center justify-center`}>
                  <CheckCircle2 className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#F8FAFC] border-2 border-[#E5E7EB] flex items-center justify-center">
                  <Circle className="w-4 h-4 text-[#9CA3AF]" strokeWidth={2} />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 pb-8">
              <div className={`font-semibold text-sm mb-1 ${isCompleted ? 'text-[#0B1220]' : 'text-[#9CA3AF]'}`}>
                {step.title}
              </div>
              <div className={`text-xs ${isCompleted ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}>
                {step.description}
              </div>
              {isCurrent && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#2952E3] text-xs font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2952E3] animate-pulse" />
                  Current Status
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
