import { useState } from 'react';
import { X, Star, Sparkles, Loader2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useSubmitFeedback } from '../../../lib/api/hooks';
import { ApiError } from '../../../lib/api/client';

interface FeedbackModalProps {
  complaintId: string;
  complaintTitle: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful feedback submission. */
  onSubmitted?: () => void;
}

export default function FeedbackModal({
  complaintId,
  complaintTitle,
  isOpen,
  onClose,
  onSubmitted,
}: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hovered, setHovered] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useSubmitFeedback({
    onSuccess: () => {
      setRating(0);
      setHovered(0);
      setComment('');
      onSubmitted?.();
      onClose();
    },
  });

  if (!isOpen) return null;

  const onSubmit = async () => {
    setError(null);
    if (rating < 1 || rating > 5) {
      setError('Please choose a rating from 1 to 5 stars.');
      return;
    }
    try {
      await mutation.mutateAsync({
        complaintId,
        rating,
        comment: comment.trim() || undefined,
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(
        code === 'already_submitted'
          ? 'You have already rated this complaint.'
          : code === 'not_resolved'
            ? 'Feedback is only accepted once a complaint is resolved.'
            : 'Could not submit feedback. Please try again.',
      );
    }
  };

  const display = hovered || rating;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg bg-white border-[#E5E7EB] shadow-2xl rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] p-6 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-[#0B1220] mb-2">Rate the resolution</h2>
            <Badge className="bg-[#EEF2FF] text-[#2952E3] hover:bg-[#EEF2FF] text-xs">
              {complaintId}
            </Badge>
            <p className="text-sm text-[#6B7280] mt-2 line-clamp-2">{complaintTitle}</p>
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

        <div className="p-6 space-y-5">
          {/* Stars */}
          <div>
            <div className="text-xs text-[#6B7280] mb-2">How satisfied are you?</div>
            <div
              className="flex items-center gap-1.5"
              onMouseLeave={() => setHovered(0)}
            >
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = display >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                    onMouseEnter={() => setHovered(n)}
                    onClick={() => setRating(n)}
                    className="p-1 rounded-md hover:bg-[#FEF3C7] transition-colors"
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${filled ? 'text-[#F59E0B]' : 'text-[#E5E7EB]'}`}
                      fill={filled ? '#F59E0B' : 'none'}
                      strokeWidth={filled ? 0 : 1.5}
                    />
                  </button>
                );
              })}
              {rating > 0 && (
                <span className="ml-2 text-sm font-medium text-[#0B1220]">{rating} / 5</span>
              )}
            </div>
          </div>

          {/* Comment */}
          <div>
            <div className="text-xs text-[#6B7280] mb-2">Anything else? (optional)</div>
            <Textarea
              rows={4}
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us what worked or what could be better."
              className="border-[#E5E7EB] rounded-xl resize-none focus:ring-2 focus:ring-[#2952E3] focus:border-transparent"
            />
          </div>

          {error && <p className="text-xs text-[#EF4444]">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-[#E5E7EB] h-10 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={mutation.isPending || rating === 0}
              className="bg-[#2952E3] hover:bg-[#1e3a8a] text-white rounded-xl h-10 px-5"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" strokeWidth={2} />
                  Submitting…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" strokeWidth={2} />
                  Submit feedback
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
