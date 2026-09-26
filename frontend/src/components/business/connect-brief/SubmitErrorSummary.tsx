'use client';

export type SubmitError = {
  message: string;
  /** DOM id of the section to scroll to. Omit for general (non-field) errors. */
  targetId?: string;
};

export function scrollToBriefSection(targetId: string) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(targetId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Move focus for keyboard/screen-reader users without jumping again.
  const hadTabIndex = el.hasAttribute('tabindex');
  if (!hadTabIndex) el.setAttribute('tabindex', '-1');
  (el as HTMLElement).focus({ preventScroll: true });
  if (!hadTabIndex) {
    window.setTimeout(() => {
      // Keep it focusable only long enough for the jump; remove afterwards
      // so tab order stays clean.
      if (document.activeElement === el) (el as HTMLElement).blur();
      el.removeAttribute('tabindex');
    }, 1200);
  }
}

function scrollToErrors(id: string) {
  if (typeof document === 'undefined') return;
  // Let React paint the summary first.
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

export function showBriefErrors(
  errors: SubmitError[],
  setErrors: (errors: SubmitError[]) => void,
) {
  setErrors(errors);
  const firstTarget = errors.find((e) => e.targetId)?.targetId;
  // Stay near the submit button where the summary lives so the user sees
  // what to fix; field banners scroll up on click.
  scrollToErrors('brief-errors-submit');
  if (firstTarget) {
    // Nudge focus for screen readers after the summary is visible.
    window.setTimeout(() => {
      document.getElementById(firstTarget)?.setAttribute('data-brief-error', 'true');
    }, 50);
  }
}

/**
 * Error summary rendered directly above the submit button (and re-used at
 * the top of long brief forms). Field errors with a `targetId` render as
 * clickable banners that scroll back up to that section.
 */
export default function SubmitErrorSummary({
  errors,
  id = 'brief-errors-submit',
}: {
  errors: SubmitError[];
  id?: string;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className="mb-3 space-y-2 rounded-xl border border-[#E0B7A2] bg-[#FBEFE9] px-4 py-3"
    >
      <p className="text-sm font-semibold text-[#8B3A1A]">
        {errors.length === 1 ? 'Please fix this before submitting:' : `Please fix these ${errors.length} items before submitting:`}
      </p>
      <ul className="space-y-1.5">
        {errors.map((e, i) =>
          e.targetId ? (
            <li key={`${e.targetId}-${i}`}>
              <button
                type="button"
                onClick={() => scrollToBriefSection(e.targetId!)}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-left text-sm font-medium text-[#8B3A1A] underline decoration-[#E0B7A2] decoration-2 underline-offset-2 transition hover:bg-white"
              >
                <span>{e.message}</span>
                <span aria-hidden="true" className="shrink-0 text-xs font-bold uppercase tracking-wide">
                  Go ↑
                </span>
              </button>
            </li>
          ) : (
            <li key={`general-${i}`} className="px-1 text-sm text-[#8B3A1A]">
              {e.message}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
