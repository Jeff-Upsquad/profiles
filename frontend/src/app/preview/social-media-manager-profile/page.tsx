'use client';

import { useRouter } from 'next/navigation';
import ThreadsProfileView from '@/views/shared/ThreadsProfileView';

export default function SocialMediaManagerPublicPreviewPage() {
  const router = useRouter();

  const talentUser = {
    full_name: 'John one abraham',
    current_location: 'Bengaluru, Karnataka',
    profile_photo_url:
      'https://pub-e7922d8c9e28467a89dd39aec3725bde.r2.dev/uploads/f25837b3-eab1-4931-aa79-a4725b5767fc/profile-pictures/2da9ba92-08ad-467f-a44b-003191313f33-Screenshot_2026-04-16_at_8.32.56_PM.png',
    languages_spoken: [
      { language: 'English', proficiency: 'Fluent' },
      { language: 'Hindi', proficiency: 'Conversational' },
      { language: 'Malayalam', proficiency: 'Native' },
    ],
    age: 32,
    gender: 'male',
  };

  const category = {
    id: 'ca148001-5800-4800-8800-000000000003',
    name: 'Social Media Manager',
    slug: 'social-media-manager',
    fields: [
      {
        id: '01cae91a-8b39-43c0-a47f-09806f6f6ad6',
        category_id: 'ca148001-5800-4800-8800-000000000003',
        field_key: 'professional_title',
        field_label: 'Professional title',
        field_type: 'text',
        is_required: true,
        placeholder: null,
        helper_text: 'Use a clear title for the work you do.',
        sort_order: 10,
        is_active: true,
      },
      {
        id: '33c7dc0f-b61d-4c0c-9d57-3a75c3272591',
        category_id: 'ca148001-5800-4800-8800-000000000003',
        field_key: 'professional_summary',
        field_label: 'Professional summary',
        field_type: 'textarea',
        is_required: true,
        placeholder: null,
        helper_text: 'Describe your strengths, industries and the outcomes you deliver.',
        sort_order: 20,
        is_active: true,
      },
      {
        id: '590bd3d7-ef6e-4b90-ab7f-1ad56b785b88',
        category_id: 'ca148001-5800-4800-8800-000000000003',
        field_key: 'account_results',
        field_label: 'Accounts managed and growth results',
        field_type: 'textarea',
        is_required: false,
        placeholder: null,
        helper_text: 'Describe platforms, account sizes, engagement improvements, community work and reporting.',
        sort_order: 30,
        is_active: true,
      },
    ],
  };

  const profile = {
    id: '890dc7c4-0675-490c-9015-2d9d4fe3cbb9',
    user_id: 'f25837b3-eab1-4931-aa79-a4725b5767fc',
    category_id: 'ca148001-5800-4800-8800-000000000003',
    status: 'approved' as const,
    tier: 'pro' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_ghost: false,
    field_data: {
      professional_title: 'Senior Social Media & Community Growth Manager',
      professional_summary:
        'Results-driven Social Media Manager with 4+ years of experience crafting organic growth engines, viral short-form video strategies, and high-converting paid social campaigns for D2C brands, B2B SaaS, and consumer tech. Proven track record of scaling brand communities from 0 to 250k+ followers, boosting engagement rates by 340%, and turning social impressions into loyal customers.',
      account_results:
        '• Scaled @ZenithWear (D2C Apparel) from 12K to 185K followers on Instagram within 9 months, generating ₹42L in attributed social revenue.\n• Managed 4 multi-platform accounts (Instagram, LinkedIn, X, TikTok) with a monthly reach exceeding 3.5M accounts.\n• Boosted average engagement rate from 1.2% to 4.8% through community-led reels, interactive stories, and weekly AMAs.\n• Spearheaded influencer partnerships with 60+ creators delivering a 4.2x ROAS.\n• Automated monthly reporting dashboards in Looker Studio and Sprout Social for executive stakeholders.',
      _experience: {
        years: 4,
        months: 6,
      },
      _skills: [
        { skill: 'Social strategy', level: 5 },
        { skill: 'Content calendars', level: 5 },
        { skill: 'Community management', level: 5 },
        { skill: 'Social copywriting', level: 4 },
        { skill: 'Social analytics', level: 4 },
        { skill: 'Influencer coordination', level: 4 },
        { skill: 'Crisis response', level: 3 },
      ],
      _tools: [
        { name: 'Meta Business Suite', level: 'expert' },
        { name: 'Buffer', level: 'expert' },
        { name: 'Hootsuite', level: 'advanced' },
        { name: 'Later', level: 'advanced' },
        { name: 'Sprout Social', level: 'expert' },
        { name: 'Canva', level: 'expert' },
        { name: 'Google Analytics', level: 'advanced' },
      ],
      _ai_tools: [
        { name: 'ChatGPT', level: 'expert' },
        { name: 'Claude', level: 'expert' },
        { name: 'Canva Magic Studio', level: 'advanced' },
        { name: 'CapCut AI', level: 'expert' },
      ],
      _categories: [
        { skill: 'Instagram', level: 5 },
        { skill: 'LinkedIn', level: 5 },
        { skill: 'YouTube', level: 4 },
        { skill: 'TikTok', level: 4 },
        { skill: 'X / Twitter', level: 4 },
        { skill: 'Facebook', level: 4 },
      ],
      _industry_experience: [
        { industry: 'D2C & E-Commerce', from: '2022-01', to: '2024-06', current: false },
        { industry: 'B2B SaaS & Tech', from: '2024-06', current: true },
      ],
    },
  };



  const sampleItem = {
    profile_id: profile.id,
    sort_order: 0,
    source_type: 'upload' as const,
    admin_is_active: true,
  };
  const portfolioItems = [
    {
      ...sampleItem,
      id: 'sample-text-1',
      skill_name: 'Campaigns',
      category_name: 'Campaigns',
      file_url: '',
      file_type: 'text' as const,
      file_name: 'Text post',
      caption:
        'Scaled @ZenithWear (D2C apparel) from 12K to 185K Instagram followers in 9 months, generating ₹42L in attributed social revenue.',
      skills: [],
    },
    {
      ...sampleItem,
      id: 'sample-video-1',
      skill_name: 'Reels',
      category_name: 'Reels',
      file_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      external_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      source_type: 'link' as const,
      provider: 'youtube',
      file_type: 'video' as const,
      file_name: 'YouTube video',
      caption: 'Launch reel for a D2C skincare drop — 1.2M views in the first week.',
      skills: ['Social strategy', 'Community management'],
    },
    {
      ...sampleItem,
      id: 'sample-image-1',
      skill_name: 'Carousels',
      category_name: 'Carousels',
      file_url: talentUser.profile_photo_url,
      file_type: 'image' as const,
      file_name: 'carousel.png',
      caption: null,
      skills: ['Social copywriting', 'Content calendars'],
    },
  ];

  return (
    <ThreadsProfileView
      profile={profile as any}
      talentUser={talentUser}
      category={category as any}
      portfolioItems={portfolioItems as any}
      mode="business"
      cardEngagement={{
        card_id: 'sample-card',
        card_type: 'subscription',
        brand_name: 'Acme Foods',
        list_price: 30000,
        currency: 'INR',
        period: 'per_month',
        kind: 'bid',
        amount: 27500,
      }}
      onSendOffer={() => {}}
      onNotAFit={() => {}}
      navigation={{ current: 3, total: 24, onPrev: () => {}, onNext: () => {} }}
      isLoading={false}
      onBack={() => router.push('/talent/profiles')}
      editProfileHref={`/talent/profiles/${profile.id}/edit`}
    />
  );
}
