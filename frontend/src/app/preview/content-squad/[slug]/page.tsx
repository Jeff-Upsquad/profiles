"use client";
import { use } from 'react';
import { notFound } from 'next/navigation';
import SpecialistBriefForm from '@/components/business/connect-brief/SpecialistBriefForm';
import { CONTENT_ROLES } from '../../../../../../shared/src/contentRoles';
export default function ContentBriefPreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const role = CONTENT_ROLES.find((r) => r.slug === slug);
  if (!role) notFound();
  return <SpecialistBriefForm key={role.slug} contentRole={role} preview />;
}
