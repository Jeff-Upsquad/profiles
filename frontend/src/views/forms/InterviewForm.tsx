'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Button from '@/components/ui/Button';

interface Question {
  id: string;
  question_text: string;
  helper_text: string | null;
  field_type: 'textarea' | 'text' | 'yes_no' | 'acknowledge';
  options: unknown;
  is_required: boolean;
  display_order: number;
}

interface InterviewData {
  lead: { name: string; email: string | null; phone: string };
  form_type: string;
  questions: Question[];
  status: 'pending' | 'submitted' | 'expired';
  expires_at: string;
  submitted_at: string | null;
}

type AnswerValue = string | boolean;

function CompletedScreen({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F6] px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <h2 className="text-2xl font-semibold text-neutral-900">{title}</h2>
        <p className="mt-2 text-neutral-500">{description}</p>
        <a
          href="https://www.upsquadconnect.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block text-sm font-medium text-[#0a0a0a] hover:text-[#0a0a0a] hover:underline"
        >
          Know more about Upsquad →
        </a>
      </div>
    </div>
  );
}

export default function InterviewForm({ token }: { token: string }) {
  const [data, setData] = useState<InterviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios
      .get(`/api/interview/${token}`)
      .then((res) => setData(res.data))
      .catch((err) => {
        setLoadError(
          err.response?.data?.error || 'Unable to load interview. Please try again later.'
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  const setAnswer = (id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => ({ ...prev, [id]: '' }));
  };

  const validate = (): boolean => {
    if (!data) return false;
    const next: Record<string, string> = {};
    for (const q of data.questions) {
      if (!q.is_required) continue;
      const a = answers[q.id];
      if (q.field_type === 'acknowledge') {
        if (a !== true) next[q.id] = 'Please confirm to proceed';
      } else if (typeof a !== 'string' || a.trim() === '') {
        next[q.id] = 'This answer is required';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await axios.post(`/api/interview/${token}/submit`, { answers });
      setSubmitted(true);
    } catch (err: any) {
      setServerError(
        err.response?.data?.error || 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F6]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0a0a0a] border-t-transparent" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <CompletedScreen
        title="Link not available"
        description={loadError || 'This interview link is invalid.'}
      />
    );
  }

  if (submitted || data.status === 'submitted') {
    return (
      <CompletedScreen
        title="Thank You!"
        description="Your responses have been recorded. The Upsquad team will be in touch shortly."
      />
    );
  }

  if (data.status === 'expired') {
    return (
      <CompletedScreen
        title="Link Expired"
        description="This interview link has expired. Please contact the Upsquad team for a fresh link."
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F5F6] px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
            Upsquad
          </h1>
          <p className="mt-1 text-sm text-neutral-500">First-Level Interview</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="mb-1 text-xl font-semibold text-neutral-900">
            Hi {data.lead.name.split(' ')[0] || data.lead.name},
          </h2>
          <p className="mb-6 text-sm text-neutral-500">
            Please answer a few quick questions so we can move to the next step. This link is
            valid until{' '}
            <span className="font-medium text-neutral-700">
              {new Date(data.expires_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            .
          </p>

          {/* Read-only contact card */}
          <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              We&apos;ll reach out using
            </p>
            <div className="mt-1 grid gap-1 text-sm text-neutral-800 sm:grid-cols-2">
              <div>
                <span className="text-neutral-500">Name: </span>
                {data.lead.name}
              </div>
              <div>
                <span className="text-neutral-500">Phone: </span>
                {data.lead.phone}
              </div>
              <div className="sm:col-span-2">
                <span className="text-neutral-500">Email: </span>
                {data.lead.email || '—'}
              </div>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              If any of these are incorrect, please reply on WhatsApp before submitting.
            </p>
          </div>

          {serverError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {data.questions.map((q, idx) => (
              <div key={q.id}>
                <label className="mb-1 block text-sm font-medium text-neutral-800">
                  {idx + 1}. {q.question_text}
                  {q.is_required && <span className="ml-0.5 text-red-500">*</span>}
                </label>
                {q.helper_text && (
                  <p className="mb-2 text-xs text-neutral-500">{q.helper_text}</p>
                )}

                {q.field_type === 'textarea' && (
                  <textarea
                    rows={4}
                    value={(answers[q.id] as string) ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                      errors[q.id]
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-neutral-300 focus:border-[#0a0a0a] focus:ring-[#0a0a0a]'
                    }`}
                    placeholder="Type your answer here..."
                  />
                )}

                {q.field_type === 'text' && (
                  <input
                    type="text"
                    value={(answers[q.id] as string) ?? ''}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                      errors[q.id]
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-neutral-300 focus:border-[#0a0a0a] focus:ring-[#0a0a0a]'
                    }`}
                  />
                )}

                {q.field_type === 'yes_no' && (
                  <div className="flex gap-3">
                    {(['Yes', 'No'] as const).map((opt) => {
                      const selected = answers[q.id] === opt;
                      return (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setAnswer(q.id, opt)}
                          className={`min-w-[80px] rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                            selected
                              ? 'border-[#0a0a0a] bg-[#F5F5F6] text-[#0a0a0a]'
                              : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.field_type === 'acknowledge' && (
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={answers[q.id] === true}
                      onChange={(e) => setAnswer(q.id, e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-[#0a0a0a] focus:ring-[#0a0a0a]"
                    />
                    <span className="text-sm text-neutral-700">I confirm</span>
                  </label>
                )}

                {errors[q.id] && (
                  <p className="mt-1 text-xs text-red-600">{errors[q.id]}</p>
                )}
              </div>
            ))}

            <Button type="submit" loading={submitting} className="w-full">
              Submit Responses
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-500">
          Know more about us:{' '}
          <a
            href="https://www.upsquadconnect.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0a0a0a] hover:underline"
          >
            www.upsquadconnect.com
          </a>
        </p>
      </div>
    </div>
  );
}
