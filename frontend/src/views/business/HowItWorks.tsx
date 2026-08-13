'use client';

import HowItWorksContent from '@/components/business/HowItWorksContent';

// Standalone /business/how-it-works route. The content itself lives in
// HowItWorksContent so the same guide can also render as a section inside
// My Cards once the SquadHub tab replaces this one in the bottom nav.
export default function HowItWorks() {
  return <HowItWorksContent variant="page" />;
}
