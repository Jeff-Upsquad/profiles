"use client";
import { use } from 'react';
import { notFound } from 'next/navigation';
import SpecialistBriefForm from '@/components/business/connect-brief/SpecialistBriefForm';
import CreatorBriefForm from '@/components/business/connect-brief/CreatorBriefForm';
import { SPECIALIST_ROLES } from '../../../../../../shared/src/contentRoles';
export default function ContentBriefPreview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const role = SPECIALIST_ROLES.find((r) => r.slug === slug);
  if (!role) notFound();
  if (role.slug === 'social-media-creator') return <CreatorBriefForm preview />;
  return <SpecialistBriefForm key={role.slug} contentRole={role} preview />;
}
