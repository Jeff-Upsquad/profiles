'use client';

import { useState } from 'react';
import type { PortfolioItem } from '@/types';
import ThreadsPortfolioCard from './ThreadsPortfolioCard';

interface ThreadsPortfolioFeedProps {
  items: PortfolioItem[];
  activeTab: string;
}

export default function ThreadsPortfolioFeed({ items, activeTab }: ThreadsPortfolioFeedProps) {
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);

  const filtered = activeTab === 'All' ? items : items.filter((i) => i.skill_name === activeTab);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--threads-bg-tag)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--threads-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
        <p className="mt-3 text-[14px] text-[var(--threads-text-secondary)]">No portfolio items yet</p>
      </div>
    );
  }

  return (
    <>
      {/* Instagram-style 3-column grid */}
      <div className="grid grid-cols-3 gap-[1px] bg-[var(--threads-border-light)]">
        {filtered.map((item) => (
          <ThreadsPortfolioCard
            key={item.id}
            item={item}
            onClick={() => setSelectedItem(item)}
          />
        ))}
      </div>

      {/* Lightbox modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
          onClick={() => setSelectedItem(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setSelectedItem(null)}
            className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Content */}
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedItem.file_type === 'image' && (
              <img
                src={selectedItem.file_url}
                alt={selectedItem.file_name}
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              />
            )}
            {selectedItem.file_type === 'video' && (
              <video
                src={selectedItem.file_url}
                controls
                autoPlay
                className="max-h-[90vh] max-w-[90vw] rounded-lg"
              />
            )}
            {selectedItem.file_type === 'pdf' && (
              <div className="flex flex-col items-center gap-4 rounded-lg bg-white p-8">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <p className="text-sm font-medium text-gray-900">{selectedItem.file_name}</p>
                <a
                  href={selectedItem.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[var(--threads-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Open PDF
                </a>
              </div>
            )}

            {/* File name caption */}
            <p className="mt-3 text-center text-sm text-white/80">
              {selectedItem.file_name}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
