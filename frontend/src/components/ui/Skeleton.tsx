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
  const baseClasses = 'animate-pulse bg-[#f0f0f0]';
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
    <div className="rounded-[14px] border border-[#E7E7EA] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <Skeleton height="20px" width="60%" className="mb-3" />
      <Skeleton height="14px" width="80%" className="mb-2" />
      <Skeleton height="14px" width="40%" className="mb-4" />
      <Skeleton height="32px" width="100px" />
    </div>
  );
}
