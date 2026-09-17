'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CRM_URL, crmLeadChatEmbedUrl, crmLookupUrl } from '@/lib/crmUrl';

interface Props {
  /** Digits-only international phone (from cleanPhoneForLink). Null = closed. */
  phone: string | null;
  name?: string | null;
  onClose: () => void;
}

/**
 * Right-hand slide-over that iframes the CRM's chromeless WhatsApp thread for
 * one talent (/embed/lead-chat). Sits above the journey panel (z-50 vs z-40)
 * so the admin can chat while the journey stays open underneath. The iframe
 * carries the CRM's own login; first use asks for it once per browser.
 */
export default function CrmChatDrawer({ phone, name, onClose }: Props) {
  useEffect(() => {
    if (!phone) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phone, onClose]);

  if (!phone || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">CRM chat{name ? ` · ${name}` : ''}</p>
              <p className="truncate text-[11px] text-gray-500">WhatsApp via SquadHire CRM</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={crmLookupUrl(phone)}
              target="_blank"
              rel="noopener noreferrer"
              title="Open in CRM"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <iframe
          key={phone}
          src={crmLeadChatEmbedUrl(phone)}
          title="SquadHire CRM chat"
          className="h-full w-full flex-1 border-0 bg-gray-50"
          allow="clipboard-write; microphone"
        />
        <p className="border-t border-gray-100 px-4 py-1.5 text-[10px] text-gray-400">
          Embedded from {CRM_URL.replace(/^https?:\/\//, '')}. If it asks you to log in, use your CRM
          account — once per browser.
        </p>
      </aside>
    </div>,
    document.body,
  );
}
