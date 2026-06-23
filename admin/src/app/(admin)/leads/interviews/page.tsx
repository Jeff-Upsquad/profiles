'use client';

import InterviewSubmissionsList from '@/views/interview/InterviewSubmissionsList';
import SectionGuard from '@/views/leads/SectionGuard';

export default function InterviewSubmissionsPage() {
  return (
    <SectionGuard section="interviews">
      <InterviewSubmissionsList />
    </SectionGuard>
  );
}
