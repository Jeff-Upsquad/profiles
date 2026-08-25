'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  signInHref?: string;
}

const SUPPORT_PHONE_DIGITS = '919995266342';
const SUPPORT_PHONE_DISPLAY = '+91 99952 66342';
const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE_DIGITS}`;

export default function AlreadySubmittedSheet({
  open,
  onClose,
  title = 'Account already exists',
  message = 'You’ve already submitted an application with this number or email. Chat with Talent Support on WhatsApp and we’ll help you out.',
  signInHref,
}: Props) {
  if (!open) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <div className="animate-sheet-up pointer-events-auto mx-auto w-full max-w-xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="rounded-2xl border border-canvas-200 bg-white p-4 shadow-[0_16px_48px_-12px_rgba(24,24,27,0.3)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#25D366]">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.34 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.601.961-1 3.648 3.741-.985zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display-saas text-sm font-bold text-canvas-900">
                {title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-canvas-500">
                {message}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1ebe57] focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 sm:w-auto"
                >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.34 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.601.961-1 3.648 3.741-.985zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
                Connect on WhatsApp
              </a>
              {signInHref && (
                  <Link
                    href={signInHref}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-canvas-200 bg-white px-4 py-2.5 text-sm font-semibold text-canvas-700 transition-colors hover:bg-canvas-100 sm:w-auto"
                  >
                    Sign In Instead
                  </Link>
                )}
              </div>
              <p className="mt-2 text-center text-xs text-canvas-400 sm:text-left">
                Talent Support · {SUPPORT_PHONE_DISPLAY}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Dismiss"
              className="shrink-0 rounded-lg p-1 text-canvas-400 transition-colors hover:bg-canvas-100 hover:text-canvas-600"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
