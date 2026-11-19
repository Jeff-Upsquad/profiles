'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { formatDate } from '@/lib/formatDate';

interface ShareLink {
  id: string;
  token: string;
  profile_id: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
  is_expired: boolean;
}

interface ShareProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileId: string;
  talentName?: string;
}

type ExpiryOption = '1d' | '7d' | '14d' | '30d' | 'custom';

export default function ShareProfileModal({
  isOpen,
  onClose,
  profileId,
  talentName,
}: ShareProfileModalProps) {
  const queryClient = useQueryClient();
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>('7d');
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [latestCreatedUrl, setLatestCreatedUrl] = useState<string | null>(null);

  // Fetch existing share links for this profile
  const { data: linksData, isLoading: linksLoading } = useQuery<{ links: ShareLink[] }>({
    queryKey: ['profile-share-links', profileId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/talents/profiles/${profileId}/share-links`);
      return data;
    },
    enabled: isOpen && !!profileId,
  });

  const links = linksData?.links ?? [];

  // Compute calculated expiration date
  const targetExpiresAt = useMemo(() => {
    const now = new Date();
    if (expiryOption === '1d') {
      now.setDate(now.getDate() + 1);
      return now.toISOString();
    }
    if (expiryOption === '7d') {
      now.setDate(now.getDate() + 7);
      return now.toISOString();
    }
    if (expiryOption === '14d') {
      now.setDate(now.getDate() + 14);
      return now.toISOString();
    }
    if (expiryOption === '30d') {
      now.setDate(now.getDate() + 30);
      return now.toISOString();
    }
    // Custom: end of selected day (23:59:59)
    const custom = new Date(`${customDate}T23:59:59`);
    return custom.toISOString();
  }, [expiryOption, customDate]);

  const getPublicUrl = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/p/${token}`;
  };

  const copyToClipboard = async (url: string, token: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      toast.success('Share link copied to clipboard!');
      setTimeout(() => setCopiedToken(null), 2500);
    } catch {
      toast.error('Failed to copy link to clipboard');
    }
  };

  const createLinkMutation = useMutation({
    mutationFn: async (expiresAt: string) => {
      const { data } = await api.post(`/admin/talents/profiles/${profileId}/share-links`, {
        expires_at: expiresAt,
      });
      return data as ShareLink;
    },
    onSuccess: (newLink) => {
      queryClient.invalidateQueries({ queryKey: ['profile-share-links', profileId] });
      const fullUrl = getPublicUrl(newLink.token);
      setLatestCreatedUrl(fullUrl);
      copyToClipboard(fullUrl, newLink.token);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to create share link');
    },
  });

  const revokeLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      await api.delete(`/admin/talents/profiles/${profileId}/share-links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-share-links', profileId] });
      toast.success('Share link revoked');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to revoke share link');
    },
  });

  const handleGenerate = () => {
    createLinkMutation.mutate(targetExpiresAt);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share Profile ${talentName ? `— ${talentName}` : ''}`}
      size="md"
    >
      <div className="space-y-5">
        <p className="text-xs text-gray-500">
          Create a public, time-limited link to share this profile with clients or external reviewers.
          Contact numbers and internal notes are automatically hidden.
        </p>

        {/* Expiry selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
            Link Expiration
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: '1d', label: '24 Hours' },
              { id: '7d', label: '7 Days' },
              { id: '14d', label: '14 Days' },
              { id: '30d', label: '30 Days' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setExpiryOption(opt.id as ExpiryOption)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                  expiryOption === opt.id
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setExpiryOption('custom')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                expiryOption === 'custom'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Custom Date
            </button>
            {expiryOption === 'custom' && (
              <input
                type="date"
                value={customDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCustomDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            )}
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            Link will expire on{' '}
            <span className="font-semibold text-gray-800">
              {formatDate(targetExpiresAt)}
            </span>
          </p>
        </div>

        {/* Generate Button */}
        <div>
          <Button
            variant="primary"
            size="sm"
            className="w-full justify-center py-2 text-sm font-semibold"
            loading={createLinkMutation.isPending}
            onClick={handleGenerate}
          >
            Generate &amp; Copy Share Link
          </Button>
        </div>

        {/* Newly generated link banner */}
        {latestCreatedUrl && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-emerald-800">
                New Link Created &amp; Copied!
              </span>
              <span className="text-[10px] text-emerald-600">Active</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                readOnly
                value={latestCreatedUrl}
                className="flex-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 select-all"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(latestCreatedUrl, 'latest')}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"
              >
                {copiedToken === 'latest' ? 'Copied!' : 'Copy'}
              </button>
              <a
                href={latestCreatedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-emerald-300 bg-white p-1.5 text-emerald-700 hover:bg-emerald-50"
                title="Open in new tab"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* Past links list */}
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">
            Active &amp; Previous Links ({links.length})
          </h4>

          {linksLoading ? (
            <div className="py-4 text-center text-xs text-gray-400">Loading links...</div>
          ) : links.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No links generated yet for this profile.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {links.map((link) => {
                const url = getPublicUrl(link.token);
                const isRevoked = !!link.revoked_at;
                const isExpired = link.is_expired && !isRevoked;
                const isActive = !link.is_expired && !isRevoked;

                return (
                  <div
                    key={link.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-xs transition ${
                      isActive
                        ? 'border-gray-200 bg-white hover:border-indigo-200'
                        : 'border-gray-100 bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-700 truncate max-w-[180px]">
                          .../p/{link.token.slice(0, 8)}...
                        </span>
                        {isActive && <Badge variant="green">Active</Badge>}
                        {isExpired && <Badge variant="gray">Expired</Badge>}
                        {isRevoked && <Badge variant="red">Revoked</Badge>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        Expires: {formatDate(link.expires_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isActive && (
                        <>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(url, link.token)}
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                          >
                            {copiedToken === link.token ? 'Copied!' : 'Copy'}
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border border-gray-200 bg-white p-1 text-gray-500 hover:text-indigo-600"
                            title="Open link"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Revoke this share link? External viewers will no longer be able to access the profile.')) {
                                revokeLinkMutation.mutate(link.id);
                              }
                            }}
                            disabled={revokeLinkMutation.isPending}
                            className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100"
                          >
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
