import Skeleton from '@/components/ui/Skeleton';
import ThreadsProfileShell from './ThreadsProfileShell';

export default function ThreadsProfileSkeleton() {
  return (
    <ThreadsProfileShell
      topBar={
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 mt-2">
          <Skeleton variant="circle" width="36px" height="36px" />
          <Skeleton width="120px" height="17px" />
          <Skeleton variant="circle" width="36px" height="36px" />
        </div>
      }
    >
      <div className="px-6 pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2 mt-1">
            <Skeleton width="180px" height="28px" />
            <Skeleton width="100px" height="15px" />
          </div>
          <Skeleton variant="circle" width="84px" height="84px" />
        </div>

        <div className="mt-4 space-y-2">
          <Skeleton width="160px" height="14px" />
          <Skeleton width="220px" height="13px" />
        </div>

        <div className="mt-4 space-y-1.5">
          <Skeleton width="100%" height="14px" />
          <Skeleton width="85%" height="14px" />
          <Skeleton width="60%" height="14px" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Skeleton height="40px" className="!rounded-[10px]" />
          <Skeleton height="40px" className="!rounded-[10px]" />
        </div>
      </div>

      <div className="px-6 mt-6 space-y-5">
        <div>
          <Skeleton width="80px" height="12px" className="mb-3" />
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton width={`${100 + i * 20}px`} height="14px" />
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((d) => (
                      <Skeleton key={d} variant="circle" width="12px" height="12px" />
                    ))}
                  </div>
                  <Skeleton width="60px" height="12px" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Skeleton width="50px" height="12px" className="mb-3" />
          <div className="flex flex-wrap gap-2">
            {[70, 90, 100, 65, 55, 80].map((w, j) => (
              <Skeleton key={j} width={`${w}px`} height="32px" className="!rounded-[10px]" />
            ))}
          </div>
        </div>

        <div>
          <Skeleton width="70px" height="12px" className="mb-3" />
          <div className="flex flex-wrap gap-2">
            {[110, 95, 130].map((w, j) => (
              <Skeleton key={j} width={`${w}px`} height="32px" className="!rounded-[10px]" />
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full mt-8 border-b border-zinc-200 px-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 flex justify-center pb-3">
            <Skeleton width="60px" height="14px" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5 mt-0.5 pb-0.5 px-0.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square">
            <Skeleton width="100%" height="100%" className="!rounded-none" />
          </div>
        ))}
      </div>
    </ThreadsProfileShell>
  );
}
