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

export default function CategoriesSection() {
  const { data: categories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <section id="categories" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse bg-white rounded-2xl"></div>
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
    <section id="categories" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium uppercase tracking-widest text-neutral-400 mb-3">
            Our Squads
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-neutral-900 mb-4">
            Explore Professional Categories
          </h2>
          <p className="text-base text-neutral-500 max-w-2xl mx-auto">
            Find skilled professionals across a wide range of expertise and services
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug || category.id}`}
              className="group"
            >
              <div className="rounded-2xl bg-white p-7 transition-all duration-300 hover:shadow-md">
                <div className="mb-4 text-2xl">
                  {categoryIcons[category.name?.toLowerCase() || ''] || '⭐'}
                </div>

                <h3 className="mb-2 text-lg font-semibold text-neutral-900 group-hover:text-neutral-600 transition-colors">
                  {category.name}
                </h3>

                {category.description && (
                  <p className="text-sm text-neutral-500 mb-4 line-clamp-2 leading-relaxed">
                    {category.description}
                  </p>
                )}

                <div className="flex items-center gap-1.5 text-neutral-400 text-sm group-hover:text-neutral-600 transition-colors">
                  <span>Explore</span>
                  <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
