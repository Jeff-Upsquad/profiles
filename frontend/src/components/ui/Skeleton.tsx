interface SkeletonProps {
  variant?: 'rectangle' | 'circle';
  width?: string;
  height?: string;
  className?: string;
}

export default function Skeleton({
  variant = 'rectangle',
  width,
  height,
  className = '',
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200';
  const shape = variant === 'circle' ? 'rounded-full' : 'rounded-lg';

  return (
    <div
      className={`${baseClasses} ${shape} ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <Skeleton height="20px" width="60%" className="mb-3" />
      <Skeleton height="14px" width="80%" className="mb-2" />
      <Skeleton height="14px" width="40%" className="mb-4" />
      <Skeleton height="32px" width="100px" />
    </div>
  );
}
