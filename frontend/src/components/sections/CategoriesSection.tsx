'use client';

import { useCategories } from '@/hooks/useCategories';
import Link from 'next/link';

const categoryIcons: Record<string, string> = {
  'design': '🎨',
  'video': '🎬',
  'writing': '✍️',
  'social': '📱',
  'marketing': '📊',
  'development': '💻',
  'accounting': '💰',
  'hr': '👥',
  'legal': '⚖️',
  'finance': '💳',
};

const TINTS = ['tint-orange', 'tint-blue', 'tint-green', 'tint-purple', 'tint-pink', 'tint-amber'] as const;
const STAGGERS = ['stagger-1', 'stagger-2', 'stagger-3', 'stagger-4', 'stagger-5', 'stagger-6'] as const;

export default function CategoriesSection() {
  const { data: categories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <section id="categories" className="bg-cu-50 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-[18px] bg-white"></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section id="categories" className="bg-cu-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="font-ui text-xs uppercase tracking-[0.14em] text-cu-900 font-semibold mb-3">
            Our Squads
          </p>
          <h2 className="display-xl text-cu-900 mb-4">
            Explore Professional Categories
          </h2>
          <p className="font-ui text-base text-cu-600 max-w-2xl mx-auto">
            Find skilled professionals across a wide range of expertise and services
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category, index) => {
            const tint = TINTS[index % TINTS.length];
            const stagger = STAGGERS[index % STAGGERS.length];
            return (
              <Link
                key={category.id}
                href={`/categories/${category.slug || category.id}`}
                className="group"
              >
                <div className={`stat-card ${tint} ${stagger} h-full`}>
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl border-2 border-cu-900 shadow-[2px_2px_0_0_#000]"
                    aria-hidden="true"
                  >
                    {categoryIcons[category.name?.toLowerCase() || ''] || '⭐'}
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-cu-900">
                    {category.name}
                  </h3>

                  {category.description && (
                    <p className="font-ui text-sm text-cu-600 mb-4 line-clamp-2 leading-relaxed">
                      {category.description}
                    </p>
                  )}

                  <div
                    className="font-ui flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: 'var(--tint-text)' }}
                  >
                    <span>Explore</span>
                    <svg
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
