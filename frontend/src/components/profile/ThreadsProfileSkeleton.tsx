import Skeleton from '@/components/ui/Skeleton';
import ThreadsProfileShell from './ThreadsProfileShell';

export default function ThreadsProfileSkeleton() {
  return (
    <ThreadsProfileShell>
      {/* Top bar skeleton */}
      <div className="flex h-12 items-center justify-between border-b border-[var(--threads-border)] px-4">
        <Skeleton variant="circle" width="36px" height="36px" />
        <Skeleton width="120px" height="14px" />
        <Skeleton variant="circle" width="36px" height="36px" />
      </div>

      <div className="px-5 py-5">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton width="180px" height="30px" />
            <Skeleton width="100px" height="14px" />
          </div>
          <Skeleton variant="circle" width="84px" height="84px" />
        </div>

        {/* Category + meta */}
        <div className="mt-4 space-y-2">
          <Skeleton width="160px" height="14px" />
          <Skeleton width="220px" height="13px" />
        </div>

        {/* Bio */}
        <div className="mt-4 space-y-1.5">
          <Skeleton width="100%" height="14px" />
          <Skeleton width="85%" height="14px" />
          <Skeleton width="60%" height="14px" />
        </div>

        {/* Action buttons */}
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Skeleton height="40px" />
          <Skeleton height="40px" />
        </div>
      </div>

      {/* Detail sections skeleton */}
      <div className="px-5 space-y-5">
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <Skeleton width="80px" height="12px" className="mb-3" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 + i }).map((_, j) => (
                <Skeleton key={j} width={`${60 + j * 15}px`} height="30px" className="rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-5 mt-6 border-t border-[var(--threads-border)]" />

      {/* Portfolio tab skeleton */}
      <div className="flex gap-6 px-5 py-3">
        {[80, 60, 90].map((w, i) => (
          <Skeleton key={i} width={`${w}px`} height="14px" />
        ))}
      </div>

      {/* Portfolio card skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className="border-b border-[var(--threads-border-light)] px-5 py-4">
          <div className="flex items-center gap-3">
            <Skeleton variant="circle" width="40px" height="40px" />
            <div className="space-y-1">
              <Skeleton width="120px" height="14px" />
              <Skeleton width="80px" height="12px" />
            </div>
          </div>
          <div className="ml-[52px] mt-3">
            <Skeleton width="70%" height="15px" className="mb-2" />
            <Skeleton width="100%" height="200px" className="rounded-[10px]" />
          </div>
        </div>
      ))}
    </ThreadsProfileShell>
  );
}
