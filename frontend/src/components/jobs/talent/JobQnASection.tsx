'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import AskQuestionModal from './AskQuestionModal';
import { fmtDate } from '@/components/jobs/shared';
import type { JobQuestionForTalent } from '@/hooks/useJobs';

// Published Q&A on a job profile + the talent's own pending questions.
// answered ⇒ published (contract §7) — unanswered rows only show to the asker.

export default function JobQnASection({
  jobProfileId,
  cardId,
  questions,
  askOpen: askOpenProp,
  onAskOpenChange,
}: {
  jobProfileId: string;
  cardId?: string;
  questions: JobQuestionForTalent[];
  /** Optional controlled mode — lets the page-level "Ask a question" button
   *  open this section's modal (e.g. after scrolling down to it). */
  askOpen?: boolean;
  onAskOpenChange?: (open: boolean) => void;
}) {
  const [askOpenInternal, setAskOpenInternal] = useState(false);
  const askOpen = askOpenProp ?? askOpenInternal;
  const setAskOpen = onAskOpenChange ?? setAskOpenInternal;

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between border-b border-[#E7E7EA] px-5 py-4">
        <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
          Questions &amp; answers
        </h2>
        <Button size="sm" variant="outline" onClick={() => setAskOpen(true)}>
          Ask a question
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-[#737373]">
            No questions yet. Anything unclear about the role or the business? Ask away.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E7E7EA]">
          {questions.map((q) => (
            <li key={q.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[#0a0a0a]">Q: {q.question}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  {q.is_mine && <Badge variant="blue">You asked</Badge>}
                  {!q.is_published && <Badge variant="yellow">Awaiting answer</Badge>}
                </div>
              </div>
              {q.answer && (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-[#F5F5F6] px-3.5 py-2.5 text-sm text-[#525252]">
                  {q.answer}
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-[#a3a3a3]">
                {q.asker_name ? `${q.asker_name} · ` : ''}
                {fmtDate(q.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <AskQuestionModal
        jobProfileId={jobProfileId}
        cardId={cardId}
        open={askOpen}
        onClose={() => setAskOpen(false)}
      />
    </div>
  );
}
