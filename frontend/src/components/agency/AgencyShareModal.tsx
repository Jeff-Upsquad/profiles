'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agencyApi } from '@/services/agency-api';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categoryId?: string;
  categoryName?: string;
  agencyName?: string;
}

type ExpiryPreset = '24h' | '3d' | '7d' | '14d' | '30d' | 'custom';

export default function AgencyShareModal({
  isOpen,
  onClose,
  categoryId,
  categoryName,
  agencyName,
}: Props) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<'category' | 'all'>(categoryId ? 'category' : 'all');
  const [preset, setPreset] = useState<ExpiryPreset>('7d');
  const [customDate, setCustomDate] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);

  const { data: links = [], isLoading: isLoadingLinks } = useQuery({
    queryKey: ['agencyShareLinks'],
    queryFn: () => agencyApi.listShareLinks(),
    enabled: isOpen,
  });

  const getExpiryIso = (p: ExpiryPreset, custom: string): string => {
    const now = new Date();
    if (p === '24h') now.setHours(now.getHours() + 24);
    else if (p === '3d') now.setDate(now.getDate() + 3);
    else if (p === '7d') now.setDate(now.getDate() + 7);
    else if (p === '14d') now.setDate(now.getDate() + 14);
    else if (p === '30d') now.setDate(now.getDate() + 30);
    else if (p === 'custom') {
      if (!custom) throw new Error('Please pick a custom expiration date');
      const d = new Date(custom);
      if (isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        throw new Error('Custom expiration date must be in the future');
      }
      return d.toISOString();
    }
    return now.toISOString();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const expiresAt = getExpiryIso(preset, customDate);
      const selectedCategoryId = scope === 'category' ? categoryId : null;
      return agencyApi.createShareLink({
        category_id: selectedCategoryId || null,
        expires_at: expiresAt,
      });
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['agencyShareLinks'] });
      setNewlyCreatedToken(data.token);
      toast.success('Shareable link created!');
      // Copy automatically
      const url = getFullShareUrl(data.token);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
          setCopiedId(data.id || data.token);
          setTimeout(() => setCopiedId(null), 3000);
        });
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create share link');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (linkId: string) => agencyApi.revokeShareLink(linkId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agencyShareLinks'] });
      toast.success('Share link revoked');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to revoke link');
    },
  });

  const getFullShareUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/share/agency/${token}`;
    }
    return `/share/agency/${token}`;
  };

  const handleCopy = (token: string, id: string) => {
    const url = getFullShareUrl(token);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(id);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopiedId(null), 2500);
      });
    }
  };

  const formatExpiryNotice = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      const ms = d.getTime() - Date.now();
      if (ms <= 0) return 'Expired';
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      let duration = '';
      if (days > 0) duration = `${days}d ${hours}h remaining`;
      else duration = `${hours}h remaining`;

      const formatted = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
      return `${formatted} (${duration})`;
    } catch {
      return isoDate;
    }
  };

  // Min date for custom date picker: 1 hour from now
  const minCustomDate = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-[#E7E7EA] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7E7EA] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFFAC2] text-[#92400E]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div>
              <h2 className="font-[family-name:var(--font-jakarta)] text-base font-semibold text-[#0a0a0a]">
                Share Public Preview
              </h2>
              <p className="text-xs text-[#737373]">
                Anyone with this link can view your portfolio without signing in.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#737373] hover:bg-[#F5F5F6] hover:text-[#0a0a0a]"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Newly created link banner if just created */}
          {newlyCreatedToken && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Link ready &amp; copied to clipboard!</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getFullShareUrl(newlyCreatedToken)}
                  className="flex-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-mono text-[#0a0a0a] select-all focus:outline-none"
                />
                <button
                  onClick={() => handleCopy(newlyCreatedToken, 'newly-created')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {copiedId === 'newly-created' ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Scope selection if categoryId present */}
          {categoryId && (
            <div>
              <label className="block text-xs font-semibold text-[#0a0a0a] mb-2">Portfolio Scope</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('category')}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    scope === 'category'
                      ? 'border-[#0a0a0a] bg-[#F5F5F6] ring-1 ring-[#0a0a0a]'
                      : 'border-[#E7E7EA] hover:border-[#a3a3a3]'
                  }`}
                >
                  <span className="text-xs font-semibold text-[#0a0a0a]">
                    {categoryName || 'Current Category'}
                  </span>
                  <span className="text-[11px] text-[#737373] mt-0.5">
                    Only {categoryName} items &amp; members
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                    scope === 'all'
                      ? 'border-[#0a0a0a] bg-[#F5F5F6] ring-1 ring-[#0a0a0a]'
                      : 'border-[#E7E7EA] hover:border-[#a3a3a3]'
                  }`}
                >
                  <span className="text-xs font-semibold text-[#0a0a0a]">All Categories</span>
                  <span className="text-[11px] text-[#737373] mt-0.5">Full agency portfolio</span>
                </button>
              </div>
            </div>
          )}

          {/* Expiry selection */}
          <div>
            <label className="block text-xs font-semibold text-[#0a0a0a] mb-2">
              Link Expiration Date
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(
                [
                  { id: '24h', label: '24 Hours' },
                  { id: '3d', label: '3 Days' },
                  { id: '7d', label: '7 Days' },
                  { id: '14d', label: '14 Days' },
                  { id: '30d', label: '30 Days' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPreset(opt.id)}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                    preset === opt.id
                      ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                      : 'border-[#E7E7EA] bg-white text-[#525252] hover:bg-[#F5F5F6]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-2.5">
              <button
                type="button"
                onClick={() => setPreset('custom')}
                className={`text-xs font-medium transition-colors ${
                  preset === 'custom' ? 'text-[#0a0a0a] font-semibold underline' : 'text-[#737373] hover:text-[#0a0a0a]'
                }`}
              >
                Or pick a custom expiration date &amp; time →
              </button>

              {preset === 'custom' && (
                <div className="mt-2">
                  <input
                    type="datetime-local"
                    min={minCustomDate}
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full rounded-lg border border-[#E7E7EA] px-3 py-2 text-xs text-[#0a0a0a] focus:border-[#0a0a0a] focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Create Button */}
          <div>
            <button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0a0a0a] px-4 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Generating shareable link...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Create Shareable Link</span>
                </>
              )}
            </button>
          </div>

          {/* Existing links */}
          <div className="border-t border-[#E7E7EA] pt-4">
            <h3 className="text-xs font-semibold text-[#0a0a0a] mb-2.5">
              Active &amp; Previous Share Links
            </h3>

            {isLoadingLinks ? (
              <div className="py-4 text-center text-xs text-[#737373]">Loading links...</div>
            ) : links.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E7E7EA] p-4 text-center text-xs text-[#737373]">
                No share links generated yet.
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link: any) => {
                  const isCopied = copiedId === link.id;
                  return (
                    <div
                      key={link.id}
                      className="rounded-xl border border-[#E7E7EA] bg-[#FAFAFA] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              link.is_expired
                                ? 'bg-zinc-200 text-zinc-600'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {link.is_expired ? 'Expired' : 'Active'}
                          </span>
                          <span className="text-xs font-medium text-[#0a0a0a] truncate">
                            {link.category_name ? `${link.category_name}` : 'All categories'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!link.is_expired && (
                            <button
                              type="button"
                              onClick={() => handleCopy(link.token, link.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E7E7EA] bg-white px-2 py-1 text-[11px] font-medium text-[#0a0a0a] hover:bg-[#F5F5F6]"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>{isCopied ? 'Copied' : 'Copy'}</span>
                            </button>
                          )}
                          {!link.is_expired && (
                            <button
                              type="button"
                              disabled={revokeMutation.isPending}
                              onClick={() => {
                                if (confirm('Revoke this share link immediately?')) {
                                  revokeMutation.mutate(link.id);
                                }
                              }}
                              className="rounded-lg p-1 text-[#737373] hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Revoke link"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-[#737373]">
                        {link.is_expired
                          ? `Expired on ${new Date(link.expires_at).toLocaleDateString()}`
                          : `Expires: ${formatExpiryNotice(link.expires_at)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
