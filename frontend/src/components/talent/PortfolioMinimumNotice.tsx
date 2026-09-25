/**
 * Progress toward a category's minimum portfolio size (Designer / Video
 * Editor need 10 items before the profile can be submitted for review).
 */
export default function PortfolioMinimumNotice({
  categoryName,
  count,
  min,
  className = '',
}: {
  categoryName: string;
  count: number;
  min: number;
  className?: string;
}) {
  const met = count >= min;
  const remaining = Math.max(0, min - count);
  const pct = Math.min(100, Math.round((count / min) * 100));
  return (
    <div
      role="status"
      className={`rounded-xl p-3.5 text-sm ring-1 ring-inset ${
        met ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200'
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p>
          {met ? (
            <>
              <span className="font-semibold">Portfolio requirement met.</span> You can submit this profile for review.
            </>
          ) : (
            <>
              <span className="font-semibold">
                {categoryName} profiles need at least {min} portfolio items
              </span>{' '}
              before they can be submitted for review. Upload {remaining} more.
            </>
          )}
        </p>
        <span className="shrink-0 font-[family-name:var(--font-inter)] text-xs font-semibold tabular-nums">
          {Math.min(count, min)}/{min}
        </span>
      </div>
      <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${met ? 'bg-emerald-100' : 'bg-amber-100'}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${met ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
