-- Migration: 00085_sales_form_and_category
-- Description: Add the "Sales" job profile end-to-end:
--   1. 'sales' value on lead_form_type_enum (public lead form)
--   2. public_forms row for /apply/sales
--   3. 'sales' category (talent job profile)
--   4. Sales skill sets / tools / AI tools template content
--
-- Safe to re-run (ON CONFLICT / IF NOT EXISTS). Paste into the Supabase
-- SQL editor and run. NOTE: the ALTER TYPE statement (step 1) must be run
-- on its own (Postgres will not let a new enum value be used in the same
-- transaction it is added in) — running this file top-to-bottom is fine
-- because nothing here inserts a lead with form_type = 'sales'.

-- ============================================================================
-- 1. Lead form type enum — add 'sales'
-- ============================================================================
ALTER TYPE lead_form_type_enum ADD VALUE IF NOT EXISTS 'sales';

-- ============================================================================
-- 2. Public form row — drives /apply/sales + admin Form Manager
-- ============================================================================
INSERT INTO public_forms (form_type, title, description, url_path, enabled) VALUES
  ('sales', 'Sales', 'Form for sales professionals arriving from Meta ads', '/apply/sales', true)
ON CONFLICT (form_type) DO NOTHING;

-- ============================================================================
-- 3. Talent job-profile category
-- ============================================================================
INSERT INTO categories (name, slug, description, is_active, sort_order)
VALUES (
  'Sales',
  'sales',
  'Sales, business development, and account management professionals.',
  TRUE,
  40
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 4a. Skill Sets
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'sales' LIMIT 1)
INSERT INTO template_skill_sets (category_id, name, sort_order)
SELECT cat.id, v.name, v.sort_order FROM cat CROSS JOIN (VALUES
  ('Lead Generation',                 0),
  ('Prospecting',                    10),
  ('Cold Calling',                   20),
  ('Inside Sales',                   30),
  ('Field Sales',                    40),
  ('B2B Sales',                      50),
  ('B2C Sales',                      60),
  ('Telesales',                      70),
  ('Solution Selling',               80),
  ('Negotiation',                    90),
  ('Closing Deals',                 100),
  ('Account Management',            110),
  ('Key Account Management',        120),
  ('Relationship Building',         130),
  ('Channel & Distributor Sales',   140),
  ('Retail Sales',                  150),
  ('Upselling & Cross-selling',     160),
  ('Sales Pipeline Management',     170),
  ('Territory Management',          180),
  ('Customer Retention',            190),
  ('After-sales Support',           200),
  ('Sales Presentations & Demos',   210),
  ('Proposal & Tender Management',  220),
  ('Market Research',               230)
) AS v(name, sort_order)
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================================================
-- 4b. Tools: CRM (grouped) + Other Tools
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'sales' LIMIT 1)
INSERT INTO template_tools (category_id, name, "group", sort_order)
SELECT cat.id, v.name, v."group", v.sort_order FROM cat CROSS JOIN (VALUES
  -- CRM
  ('Salesforce',                  'CRM',          0),
  ('HubSpot',                     'CRM',         10),
  ('Zoho CRM',                    'CRM',         20),
  ('Freshsales',                  'CRM',         30),
  ('Pipedrive',                   'CRM',         40),
  ('Microsoft Dynamics 365',      'CRM',         50),
  ('LeadSquared',                 'CRM',         60),
  ('Kylas',                       'CRM',         70),
  ('Bitrix24',                    'CRM',         80),
  ('Close',                       'CRM',         90),
  ('Monday Sales CRM',            'CRM',        100),
  -- Other Tools
  ('Microsoft Excel',             'Other Tools', 1000),
  ('Google Sheets',               'Other Tools', 1010),
  ('LinkedIn Sales Navigator',    'Other Tools', 1020),
  ('WhatsApp Business',           'Other Tools', 1030),
  ('Gmail / Outlook',             'Other Tools', 1040),
  ('Zoom / Google Meet',          'Other Tools', 1050),
  ('Calendly',                    'Other Tools', 1060),
  ('Slack',                       'Other Tools', 1070),
  ('Canva',                       'Other Tools', 1080),
  ('IndiaMART',                   'Other Tools', 1090),
  ('Justdial',                    'Other Tools', 1100),
  ('Razorpay / Payment Links',    'Other Tools', 1110)
) AS v(name, "group", sort_order)
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================================================
-- 4c. AI Tools
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'sales' LIMIT 1)
INSERT INTO template_ai_tools (category_id, name, sort_order)
SELECT cat.id, v.name, v.sort_order FROM cat CROSS JOIN (VALUES
  ('ChatGPT',            0),
  ('Claude',            10),
  ('Google Gemini',     20),
  ('Microsoft Copilot', 30),
  ('Perplexity',        40),
  ('Apollo.io',         50),
  ('Lusha',             60),
  ('Clay',              70),
  ('Gong',              80),
  ('Chorus.ai',         90),
  ('Outreach',         100),
  ('Lavender',         110),
  ('Instantly',        120),
  ('Notion AI',        130),
  ('Otter.ai',         140)
) AS v(name, sort_order)
ON CONFLICT (category_id, name) DO NOTHING;
