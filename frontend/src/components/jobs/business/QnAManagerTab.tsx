'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import {
  useAnswerJobQuestion,
  useDeleteJobQuestion,
  useJobQuestions,
} from '@/hooks/useBusinessJobs';
import { fmtDate } from '@/components/jobs/shared';

// Candidate Q&A manager. Answering PUBLISHES the answer on the job profile
// (answered ⇒ published — contract §7); delete is a soft tombstone.

export default function QnAManagerTab({ cardId }: { cardId: string }) {
  const { data: questions, isLoading } = useJobQuestions(cardId);
  const answerMutation = useAnswerJobQuestion(cardId);
  const deleteMutation = useDeleteJobQuestion(cardId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#f0f0f0]" />;
  }

  const list = questions ?? [];

  return (
    <div className="rounded-2xl border border-[#E7E7EA] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-[#E7E7EA] px-5 py-4">
        <h2 className="font-[family-name:var(--font-jakarta)] text-sm font-semibold text-[#0a0a0a]">
          Candidate questions
        </h2>
        <p className="mt-0.5 text-xs text-[#737373]">
          Answers are published on the job profile for every candidate to see.
        </p>
      </div>

      {list.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-[#737373]">No questions from candidates yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E7E7EA]">
          {list.map((q) => {
            const draft = drafts[q.id] ?? '';
            return (
              <li key={q.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a0a0a]">Q: {q.question}</p>
                    <p className="mt-1 text-[11px] text-[#a3a3a3]">
                      {q.asker_name ?? 'A candidate'} · {fmtDate(q.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {q.answered_at ? (
                      <Badge variant="green">Published</Badge>
                    ) : (
                      <Badge variant="yellow">Unanswered</Badge>
                    )}
                    <button
                      type="button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm('Delete this question? It disappears from the job profile too.')) {
                          deleteMutation.mutate(q.id);
                        }
                      }}
                      className="text-xs font-semibold text-[#737373] hover:text-red-600 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {q.answer ? (
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-[#F5F5F6] px-3.5 py-2.5 text-sm text-[#525252]">
                    {q.answer}
                  </p>
                ) : (
                  <div className="mt-2">
                    <Textarea
                      rows={2}
                      value={draft}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Write your answer — it will be published on the job profile…"
                      maxLength={4000}
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        loading={answerMutation.isPending}
                        disabled={draft.trim().length === 0}
                        onClick={() =>
                          answerMutation.mutate(
                            { questionId: q.id, answer: draft.trim() },
                            {
                              onSuccess: () =>
                                setDrafts((prev) => {
                                  const next = { ...prev };
                                  delete next[q.id];
                                  return next;
                                }),
                            },
                          )
                        }
                      >
                        Answer &amp; publish
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
