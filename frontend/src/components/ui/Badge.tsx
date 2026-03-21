import type { ReactNode } from 'react';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'indigo';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800',
  indigo: 'bg-indigo-100 text-indigo-800',
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
