'use client';
import SpecialistBriefForm from './SpecialistBriefForm';
export default function AdsSpecialistBriefForm(props: { product?: 'subscription' | 'assignment'; preview?: boolean }) {
  return <SpecialistBriefForm {...props} />;
}
