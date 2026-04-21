-- Seed: Accountant category content
-- Run AFTER migration 00023_template_tools_group and AFTER the "Accountant"
-- category exists with slug 'accountant'. Safe to re-run (ON CONFLICT).
--
-- Paste all three statements into Supabase SQL editor and run.

-- ============================================================================
-- 1. Skill Sets (20)
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'accountant' LIMIT 1)
INSERT INTO template_skill_sets (category_id, name, sort_order)
SELECT cat.id, v.name, v.sort_order FROM cat CROSS JOIN (VALUES
  ('GST Filing',                          0),
  ('TDS Calculations and Filing',        10),
  ('ESI / PF Calculations and Filing',   20),
  ('ITR Filing Personal',                30),
  ('ITR Filing Business',                40),
  ('UAE VAT related knowledge',          50),
  ('Bookkeeping',                        60),
  ('Bank Reconciliation',                70),
  ('Accounts Payable / Receivable',      80),
  ('Payroll Processing',                 90),
  ('Financial Statement Preparation',   100),
  ('Cash Flow Management',              110),
  ('Inventory Accounting',              120),
  ('Audit Support',                     130),
  ('Cost Accounting',                   140),
  ('Budgeting & Forecasting',           150),
  ('MIS Reporting',                     160),
  ('ROC / MCA Filings',                 170),
  ('Management Accounting',             180),
  ('Advance Tax Computation',           190)
) AS v(name, sort_order)
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================================================
-- 2. Tools: Accounting Software (41) + Other Tools (15)
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'accountant' LIMIT 1)
INSERT INTO template_tools (category_id, name, "group", sort_order)
SELECT cat.id, v.name, v."group", v.sort_order FROM cat CROSS JOIN (VALUES
  -- Accounting Software (primary)
  ('Zohobooks',                       'Accounting Software',   0),
  ('Tally',                           'Accounting Software',  10),
  ('Quick Books',                     'Accounting Software',  20),
  ('Vyapar',                          'Accounting Software',  30),
  ('Odoo',                            'Accounting Software',  40),
  ('ERPnext',                         'Accounting Software',  50),
  -- Accounting Software (alphabetical)
  ('Bookkeeper',                      'Accounting Software', 100),
  ('Bookkeeper App',                  'Accounting Software', 110),
  ('Busy',                            'Accounting Software', 120),
  ('Cleartax',                        'Accounting Software', 130),
  ('Deskera',                         'Accounting Software', 140),
  ('EazyPharma',                      'Accounting Software', 150),
  ('Eduflex',                         'Accounting Software', 160),
  ('Focus ERP',                       'Accounting Software', 170),
  ('FreshBooks',                      'Accounting Software', 180),
  ('Genius',                          'Accounting Software', 190),
  ('Ginesys',                         'Accounting Software', 200),
  ('GoFrugal',                        'Accounting Software', 210),
  ('HostBooks',                       'Accounting Software', 220),
  ('JustBilling',                     'Accounting Software', 230),
  ('KDK Spectrum',                    'Accounting Software', 240),
  ('Khatabook',                       'Accounting Software', 250),
  ('Logic ERP',                       'Accounting Software', 260),
  ('Marg ERP',                        'Accounting Software', 270),
  ('MyBillBook',                      'Accounting Software', 280),
  ('MyClassCampus',                   'Accounting Software', 290),
  ('Oracle NetSuite',                 'Accounting Software', 300),
  ('Petpooja',                        'Accounting Software', 310),
  ('Posist',                          'Accounting Software', 320),
  ('ProfitBooks',                     'Accounting Software', 330),
  ('QuickFile',                       'Accounting Software', 340),
  ('Ramco ERP',                       'Accounting Software', 350),
  ('Reach Accountant',                'Accounting Software', 360),
  ('Redbook',                         'Accounting Software', 370),
  ('SAP',                             'Accounting Software', 380),
  ('Saral Accounts',                  'Accounting Software', 390),
  ('TaxCloud India',                  'Accounting Software', 400),
  ('Torqus',                          'Accounting Software', 410),
  ('Wave',                            'Accounting Software', 420),
  ('Winman',                          'Accounting Software', 430),
  ('Xero',                            'Accounting Software', 440),
  -- Other Tools
  ('Microsoft Excel',                 'Other Tools',        1000),
  ('Google Sheets',                   'Other Tools',        1010),
  ('Microsoft Word',                  'Other Tools',        1020),
  ('Google Docs',                     'Other Tools',        1030),
  ('PowerPoint',                      'Other Tools',        1040),
  ('Gmail / Outlook',                 'Other Tools',        1050),
  ('WhatsApp Business',               'Other Tools',        1060),
  ('Slack',                           'Other Tools',        1070),
  ('Google Drive',                    'Other Tools',        1080),
  ('Dropbox',                         'Other Tools',        1090),
  ('Zoom / Google Meet',              'Other Tools',        1100),
  ('Adobe Acrobat (PDF)',             'Other Tools',        1110),
  ('Canva',                           'Other Tools',        1120),
  ('Razorpay / PayU',                 'Other Tools',        1130),
  ('Digital signature (emSigner / DSC)', 'Other Tools',     1140)
) AS v(name, "group", sort_order)
ON CONFLICT (category_id, name) DO NOTHING;

-- ============================================================================
-- 3. AI Tools (15)
-- ============================================================================
WITH cat AS (SELECT id FROM categories WHERE slug = 'accountant' LIMIT 1)
INSERT INTO template_ai_tools (category_id, name, sort_order)
SELECT cat.id, v.name, v.sort_order FROM cat CROSS JOIN (VALUES
  ('ChatGPT',                  0),
  ('Claude',                  10),
  ('Google Gemini',           20),
  ('Microsoft Copilot',       30),
  ('Perplexity',              40),
  ('Zoho Zia',                50),
  ('QuickBooks Intuit Assist', 60),
  ('Docyt',                   70),
  ('Vic.ai',                  80),
  ('Booke AI',                90),
  ('Dext',                   100),
  ('Nanonets',               110),
  ('Klippa',                 120),
  ('Notion AI',              130),
  ('Otter.ai',               140)
) AS v(name, sort_order)
ON CONFLICT (category_id, name) DO NOTHING;
