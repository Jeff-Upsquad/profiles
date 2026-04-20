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
