/**
 * Amber "needs completion" tag used across the talent portal — sidebar, More
 * page, Basic Profile sections and job-profile cards — so pending work reads
 * the same everywhere.
 */
export default function PendingTag({
  label = 'Pending',
  title,
  size = 'sm',
  className = '',
}: {
  label?: string;
  title?: string;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 font-[family-name:var(--font-inter)] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200 ${
        size === 'xs' ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-[11px]'
      } ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      {label}
    </span>
  );
}
