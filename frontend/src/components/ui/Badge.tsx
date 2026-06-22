import type { ReactNode } from 'react';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'indigo' | 'blue';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  gray: 'bg-[#f0f0f0] text-[#525252] ring-1 ring-inset ring-[#E7E7EA]',
  indigo: 'bg-[#FFFAC2] text-[#0a0a0a] ring-1 ring-inset ring-[#0a0a0a]',
  blue: 'bg-[#F5F5F6] text-[#0a0a0a] ring-1 ring-inset ring-[#E7E7EA]',
};

export function statusToBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'approved':
      return 'green';
    case 'pending_review':
      return 'yellow';
    case 'rejected':
      return 'red';
    case 'draft':
    case 'inactive':
      return 'gray';
    default:
      return 'gray';
  }
}

export default function Badge({
  variant = 'gray',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`font-[family-name:var(--font-inter)] inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tracking-[-0.01em] ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
