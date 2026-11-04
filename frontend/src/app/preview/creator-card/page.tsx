'use client';

import { useState } from 'react';
import BusinessCardDetails from '@/components/business/cards/BusinessCardDetails';
import type { BusinessSubscriptionCardDetail } from '@/hooks/useBusiness';

export default function CreatorCardPreview() {
  const [isAssignment, setIsAssignment] = useState(true);
  const [minimal, setMinimal] = useState(false);
  const card: BusinessSubscriptionCardDetail = {
    id: 'preview-creator-card', external_id: 'preview', brand_name: 'tag connect',
    customer_company: 'tag connect', subscription_name: 'Social Media Creator',
    plan_name: null, plan_tier: 'Custom', customer_location: null,
    customer_monthly_price: null, currency: 'INR',
    description: 'Accounts management for other brands', business_nature: 'Accounts',
    hours_label: null, working_days: isAssignment ? [] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    additional_requirements: minimal ? null : {
      channels: ['Instagram', 'YouTube'], creator_niches: ['Business', 'Lifestyle'],
      creator_formats: ['Reels', 'Stories'], creator_services: ['Brand promotion'],
      service_count: ['Brand promotion × 3'],
      creator_levels: [`10,000 to 25,000 (INR 15,000${isAssignment ? '' : ' / month'})`, `50,000 to 100k (INR 40,000${isAssignment ? '' : ' / month'})`],
      desired_age: ['18–24', '25–34'], audience_location: ['India · Kerala'],
      usage_rights: ['Organic social use for 30 days. One round of approvals.'],
      campaign_logistics: ['Brand will send products before the start date.'],
      reference_links: ['https://www.instagram.com/'],
    },
    target_tiers: ['Junior', 'Pro', 'Top Talents', 'Agencies', 'Custom'],
    target_languages: ['English'], target_country_names: [], target_regions: [],
    custom_deliverables: [], status: 'submitted', recalled_at: null, paused_at: null,
    cancelled_at: null, subscription_activated_at: null, published_at: null, expires_at: null,
    card_type: isAssignment ? 'assignment' : 'subscription',
    assignment_details: isAssignment ? {start_date: '2026-11-05', deadline: '2026-11-07'} : null,
    category_ids: ['creator'], categories: [{ id: 'creator', name: 'Social Media Creator', slug: 'social-media-creator' }],
  };
  return (
    <main className="min-h-screen bg-[#F5F5F6] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#737373]">Local preview · Sample submitted details</p>
          <h1 className="mt-2 text-xl font-semibold">Social Media Creator card</h1>
          <p className="mt-1 text-sm text-[#737373]">Uses the same details component as My Cards. Sample values illustrate how the submitted brief appears.</p>
        </header>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setIsAssignment(true)} aria-pressed={isAssignment} className={`rounded-full border px-4 py-2 text-sm ${isAssignment ? 'bg-black text-white' : 'bg-white'}`}>Assignment</button>
          <button onClick={() => setIsAssignment(false)} aria-pressed={!isAssignment} className={`rounded-full border px-4 py-2 text-sm ${!isAssignment ? 'bg-black text-white' : 'bg-white'}`}>Subscription</button>
          <label className="flex items-center gap-2 px-2 text-sm"><input type="checkbox" checked={minimal} onChange={(event) => setMinimal(event.target.checked)} />Without optional creator details</label>
        </div>
        <BusinessCardDetails card={card} />
      </div>
    </main>
  );
}
