import Skeleton from '@/components/ui/Skeleton';
import ThreadsProfileShell from './ThreadsProfileShell';

export default function ThreadsProfileSkeleton() {
  return (
    <ThreadsProfileShell
      topBar={
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 mt-2">
          <Skeleton variant="circle" width="44px" height="44px" />
          <div className="flex flex-col items-center gap-1.5">
            <Skeleton width="90px" height="17px" />
            <Skeleton width="120px" height="12px" />
          </div>
          <Skeleton variant="circle" width="44px" height="44px" />
        </div>
      }
    >
      <div className="px-6 pt-6">
        {/* Header skeleton */}
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2 mt-1">
            <Skeleton width="180px" height="28px" />
            <Skeleton width="100px" height="15px" />
            <Skeleton width="140px" height="13px" />
          </div>
          <Skeleton variant="circle" width="84px" height="84px" />
        </div>

        {/* Bio */}
        <div className="mt-4 space-y-1.5">
          <Skeleton width="100%" height="14px" />
          <Skeleton width="85%" height="14px" />
          <Skeleton width="60%" height="14px" />
        </div>

        {/* Meta line */}
        <div className="mt-3">
          <Skeleton width="180px" height="13px" />
        </div>

        {/* Fact strip */}
        <div className="mt-4 flex gap-2">
          {[120, 150, 100].map((w, i) => (
            <Skeleton key={i} width={`${w}px`} height="52px" className="!rounded-[14px]" />
          ))}
        </div>

        {/* Skills & tools row */}
        <div className="mt-4">
          <Skeleton width="100%" height="56px" className="!rounded-[14px]" />
        </div>
      </div>

      {/* Portfolio tab skeleton */}
      <div className="flex w-full mt-6 border-b border-zinc-200 px-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 flex justify-center pb-3">
            <Skeleton width="60px" height="14px" />
          </div>
        ))}
      </div>

      {/* Post feed skeleton */}
      {[1, 2].map((i) => (
        <div key={i} className="border-b border-zinc-200 px-6 py-4">
          <Skeleton width="120px" height="14px" />
          <div className="mt-2 space-y-1.5">
            <Skeleton width="90%" height="14px" />
            <Skeleton width="65%" height="14px" />
          </div>
          <div className="mt-3">
            <Skeleton width="280px" height="350px" className="!rounded-[10px]" />
          </div>
        </div>
      ))}
    </ThreadsProfileShell>
  );
}
