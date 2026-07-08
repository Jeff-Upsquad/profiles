'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { useAskJobQuestion } from '@/hooks/useJobs';

// Ask-a-question modal on the job profile. Answered questions get published
// as Q&A for every candidate viewing the profile.

export default function AskQuestionModal({
  jobProfileId,
  cardId,
  open,
  onClose,
}: {
  jobProfileId: string;
  cardId?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState('');
  const ask = useAskJobQuestion(jobProfileId);

  const submit = () => {
    const q = question.trim();
    if (q.length < 3) return;
    ask.mutate(
      { question: q, ...(cardId ? { card_id: cardId } : {}) },
      {
        onSuccess: () => {
          setQuestion('');
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Ask a question">
      <p className="mb-3 text-sm text-[#525252]">
        The business will be notified and you&apos;ll get an answer here. Answered questions are
        published on the job profile for other candidates too.
      </p>
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. Is there a fixed shift or flexible hours?"
        maxLength={2000}
      />
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" loading={ask.isPending} disabled={question.trim().length < 3} onClick={submit}>
          Send question
        </Button>
      </div>
    </Modal>
  );
}
