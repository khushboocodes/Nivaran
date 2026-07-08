import { useState, useRef, useEffect, useMemo } from 'react';
import CitizenLayout from '../../components/layouts/CitizenLayout';
import { Bot, Send } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useComplaints } from '../../contexts/ComplaintContext';
import { format } from 'date-fns';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'How many of my complaints are resolved?',
  'What is the status of my latest complaint?',
  'How do I file a complaint?',
  'How long does resolution take?',
];

/**
 * Try to answer the user's question from local complaint state without
 * hitting the API. Returns `null` when the question doesn't match any of
 * the known patterns, in which case we fall through to the streaming chat.
 *
 * Patterns covered: "how many resolved/pending/critical/total",
 * "latest complaint", "show critical", "what's the status of <id>".
 * Adding more patterns here is cheap — pure string ops, runs entirely in
 * the browser, so the answer is instantaneous and free.
 */
function tryLocalAnswer(
  question: string,
  complaints: ReturnType<typeof useComplaints>['complaints'],
): string | null {
  const q = question.toLowerCase().trim();
  const total = complaints.length;
  const resolved = complaints.filter((c) => c.status === 'Resolved');
  const pending = complaints.filter(
    (c) => c.status === 'Submitted' || c.status === 'Under Review',
  );
  const inProgress = complaints.filter((c) => c.status === 'In Progress' || c.status === 'Assigned');
  const critical = complaints.filter((c) => c.priority === 'Critical');

  const isCount = /how many|number of|count/.test(q);
  const isList = /show|list|what are|which/.test(q);

  // ── Total ────────────────────────────────────────────────────────────
  if (isCount && /(complaint|file)/.test(q) && !/(resolved|pending|progress|critical|escalated)/.test(q)) {
    if (total === 0) return "You haven't filed any complaints yet. Use Submit Complaint in the sidebar to start.";
    return `You have filed ${total} complaint${total === 1 ? '' : 's'} so far.`;
  }

  // ── Resolved ─────────────────────────────────────────────────────────
  if ((isCount || /resolved/.test(q)) && /resolved/.test(q)) {
    if (total === 0) return "You haven't filed any complaints yet, so nothing has been resolved.";
    const pct = total > 0 ? Math.round((resolved.length / total) * 100) : 0;
    return `${resolved.length} of your ${total} complaint${total === 1 ? '' : 's'} ${
      resolved.length === 1 ? 'has' : 'have'
    } been resolved (${pct}% resolution rate).`;
  }

  // ── Pending ──────────────────────────────────────────────────────────
  if (/pending|under review|awaiting|waiting/.test(q)) {
    if (pending.length === 0) return 'You have no complaints currently pending review.';
    const titles = pending.slice(0, 3).map((c) => `"${c.title}"`).join(', ');
    return `You have ${pending.length} pending complaint${pending.length === 1 ? '' : 's'}: ${titles}${
      pending.length > 3 ? ', and more' : ''
    }.`;
  }

  // ── In progress ──────────────────────────────────────────────────────
  if (/in progress|being worked|assigned/.test(q)) {
    if (inProgress.length === 0) return 'No complaints of yours are currently in progress.';
    return `${inProgress.length} of your complaints ${
      inProgress.length === 1 ? 'is' : 'are'
    } currently in progress.`;
  }

  // ── Critical / escalated ─────────────────────────────────────────────
  if (/critical|escalat|urgent/.test(q)) {
    if (critical.length === 0) return 'You have no critical-priority complaints right now.';
    const titles = critical.slice(0, 3).map((c) => `"${c.title}"`).join(', ');
    return `You have ${critical.length} critical-priority complaint${critical.length === 1 ? '' : 's'}: ${titles}${
      critical.length > 3 ? ', and more' : ''
    }. Staff are reviewing them.`;
  }

  // ── Latest complaint ─────────────────────────────────────────────────
  if (/latest|most recent|last|newest/.test(q) && /(complaint|status|update)/.test(q)) {
    if (total === 0) return "You haven't filed any complaints yet.";
    const latest = [...complaints].sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
    )[0];
    return `Your latest complaint "${latest.title}" was filed on ${format(
      latest.submittedAt,
      'MMM d, yyyy',
    )}. Current status: ${latest.status} (${latest.priority} priority). ID: ${latest.id}.`;
  }

  // ── Status of a specific id ──────────────────────────────────────────
  // Match either a quoted id or a slim cuid-ish token.
  const idMatch = q.match(/[a-z0-9]{20,}/);
  if (idMatch) {
    const found = complaints.find((c) => c.id === idMatch[0]);
    if (found) {
      return `Complaint ${found.id} ("${found.title}") is currently ${found.status} with ${found.priority} priority.`;
    }
  }

  // ── List all (limit to a few) ────────────────────────────────────────
  if (isList && /(complaint|all)/.test(q) && total > 0) {
    const summary = complaints
      .slice(0, 5)
      .map((c) => `• ${c.title} — ${c.status}`)
      .join('\n');
    return `Here are your latest complaints:\n${summary}${total > 5 ? `\n…and ${total - 5} more.` : ''}`;
  }

  return null;
}

export default function AIAssistant() {
  const { complaints } = useComplaints();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Per-user stats sent as system context to the AI for any question we
  // don't answer locally. Letting the model see the numbers means it can
  // talk about them in plain language across all 11 supported languages.
  const accountSummary = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((c) => c.status === 'Resolved').length;
    const pending = complaints.filter(
      (c) => c.status === 'Submitted' || c.status === 'Under Review',
    ).length;
    const critical = complaints.filter((c) => c.priority === 'Critical').length;
    const sorted = [...complaints].sort(
      (a, b) => b.submittedAt.getTime() - a.submittedAt.getTime(),
    );
    const lines = [
      'The user is signed in as a citizen.',
      `They have filed ${total} complaint${total === 1 ? '' : 's'} in total.`,
      `${resolved} resolved, ${pending} pending, ${critical} at Critical priority.`,
      '',
      'Full list of their complaints:',
    ];
    // Include all complaints (cap at 20 to stay within token budget)
    const toShow = sorted.slice(0, 20);
    for (const c of toShow) {
      lines.push(
        `- "${c.title}" (ID: ${c.id}) — Status: ${c.status}, Priority: ${c.priority}, Category: ${c.category}, Department: ${c.department}, Filed: ${format(c.submittedAt, 'MMM d, yyyy')}`,
      );
    }
    if (sorted.length > 20) {
      lines.push(`...and ${sorted.length - 20} more.`);
    }
    return lines.join('\n');
  }, [complaints]);

  // Keep the chat scrolled to the bottom on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Push the user turn first so the message shows up immediately.
    const turns: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(turns);
    setInput('');

    // Try to answer locally without hitting the API. The bot can resolve
    // most "my account" questions on its own from React Query state,
    // which is faster, free, and works without any LLM key.
    const local = tryLocalAnswer(trimmed, complaints);
    if (local) {
      setMessages([...turns, { role: 'assistant', content: local }]);
      return;
    }

    // Fall through to the streaming AI path. Push an empty assistant
    // placeholder we'll fill as bytes come in.
    setMessages([...turns, { role: 'assistant', content: '' }]);
    setIsStreaming(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: [
            // Sneak the per-user stats in as a leading user turn so the
            // server-side prompt template doesn't need to change. The
            // model treats it as context for the rest of the conversation.
            { role: 'user', content: `[account context]\n${accountSummary}` },
            ...turns.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 2);
          if (!frame.startsWith('data:')) continue;
          const payload = frame.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload) as { delta?: string; error?: string };
            if (json.error) throw new Error(json.error);
            if (json.delta) {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, content: last.content + json.delta };
                }
                return copy;
              });
            }
          } catch {
            // Ignore malformed frames.
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant' && last.content === '') {
          copy[copy.length - 1] = {
            ...last,
            content: 'The assistant is temporarily unavailable. Please try again in a moment.',
          };
        }
        return copy;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <CitizenLayout>
      <div className="flex flex-col h-full">
        {/* Header — unchanged */}
        <div className="px-8 py-5 border-b border-[#E5E7EB] bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#8B5CF6] flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-semibold text-[#0B1220] text-base">NIVARAN AI Assistant</h2>
                <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                  <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                  Online • Ready to help
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-auto bg-[#F8FAFC] p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* AI Greeting — unchanged */}
            <div className="flex gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-[#8B5CF6] flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" strokeWidth={2} />
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-3.5 border border-[#E5E7EB] shadow-sm max-w-xl">
                <p className="text-sm text-[#0B1220] leading-relaxed">
                  Hello! I'm NIVARAN AI Assistant. I can help you with filing complaints, tracking status, understanding processes, and answering questions about civic services. How can I assist you today?
                </p>
              </div>
            </div>

            {/* Real conversation */}
            {messages.map((m, idx) => {
              if (m.role === 'user') {
                return (
                  <div key={idx} className="flex justify-end">
                    <div className="bg-[#EEF2FF] rounded-2xl rounded-tr-sm px-5 py-3.5 border border-[#DBEAFE] shadow-sm max-w-xl">
                      <p className="text-sm text-[#0B1220] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div key={idx} className="flex gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-[#8B5CF6] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-3.5 border border-[#E5E7EB] shadow-sm max-w-xl">
                    <p className="text-sm text-[#0B1220] leading-relaxed whitespace-pre-wrap">
                      {m.content || (isStreaming && idx === messages.length - 1 ? '…' : '')}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Suggested Prompts — only when conversation is empty */}
            {messages.length === 0 && (
              <div className="space-y-4 pt-4">
                <p className="text-xs text-[#6B7280] text-center font-medium uppercase tracking-wide">Suggested Questions</p>
                <div className="grid md:grid-cols-2 gap-3">
                  {SUGGESTED_PROMPTS.map((prompt, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => send(prompt)}
                      className="group p-4 rounded-xl border border-[#E5E7EB] bg-white hover:bg-[#EEF2FF] hover:border-[#2952E3] transition-all text-left shadow-sm hover:shadow-md"
                    >
                      <p className="text-sm text-[#0B1220] group-hover:text-[#2952E3] font-medium">{prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area — unchanged shell */}
        <div className="px-8 py-5 border-t border-[#E5E7EB] bg-white">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={isStreaming}
                placeholder="Ask me anything about civic services, complaints, or NIVARAN..."
                className="h-12 border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#2952E3] focus:border-transparent"
              />
              <Button
                onClick={() => send(input)}
                disabled={isStreaming || input.trim().length === 0}
                className="bg-[#2952E3] hover:bg-[#1e3a8a] h-12 px-6 rounded-xl"
              >
                <Send className="w-4 h-4" strokeWidth={2} />
              </Button>
            </div>
            <div className="mt-3 text-xs text-[#6B7280] text-center">
              AI responses are generated. For official information, please contact support.
            </div>
          </div>
        </div>
      </div>
    </CitizenLayout>
  );
}
