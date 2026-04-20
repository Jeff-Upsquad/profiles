-- Seed: Accountant category content
-- Run AFTER migration 00023_template_tools_group and AFTER the "Accountant"
-- category has been created in the admin UI.
--
-- Edit `_category_slug` below if your category uses a different slug.
-- Safe to re-run: uses ON CONFLICT DO NOTHING on (category_id, name).

DO $$
DECLARE
  _category_slug TEXT := 'accountant';
  _cat_id UUID;
BEGIN
  SELECT id INTO _cat_id FROM categories WHERE slug = _category_slug LIMIT 1;

  IF _cat_id IS NULL THEN
    RAISE EXCEPTION 'Category with slug % not found. Create it in the admin UI first.', _category_slug;
  END IF;

  -- ==========================================================================
  -- Skill Sets (20)
  -- ==========================================================================
  INSERT INTO template_skill_sets (category_id, name, sort_order) VALUES
    (_cat_id, 'GST Filing',                          0),
    (_cat_id, 'TDS Calculations and Filing',        10),
    (_cat_id, 'ESI / PF Calculations and Filing',   20),
    (_cat_id, 'ITR Filing Personal',                30),
    (_cat_id, 'ITR Filing Business',                40),
    (_cat_id, 'UAE VAT related knowledge',          50),
    (_cat_id, 'Bookkeeping',                        60),
    (_cat_id, 'Bank Reconciliation',                70),
    (_cat_id, 'Accounts Payable / Receivable',      80),
    (_cat_id, 'Payroll Processing',                 90),
    (_cat_id, 'Financial Statement Preparation',   100),
    (_cat_id, 'Cash Flow Management',              110),
    (_cat_id, 'Inventory Accounting',              120),
    (_cat_id, 'Audit Support',                     130),
    (_cat_id, 'Cost Accounting',                   140),
    (_cat_id, 'Budgeting & Forecasting',           150),
    (_cat_id, 'MIS Reporting',                     160),
    (_cat_id, 'ROC / MCA Filings',                 170),
    (_cat_id, 'Management Accounting',             180),
    (_cat_id, 'Advance Tax Computation',           190)
  ON CONFLICT (category_id, name) DO NOTHING;

  -- ==========================================================================
  -- Tools → group = "Accounting Software" (41, reused from signup form —
  -- frontend/src/constants/lead-form-options.ts: 6 primary + 35 others)
  -- Primary 6 get sort_order 0-50; others alphabetical from 100.
  -- ==========================================================================
  INSERT INTO template_tools (category_id, name, "group", sort_order) VALUES
    -- Primary
    (_cat_id, 'Zohobooks',         'Accounting Software',   0),
    (_cat_id, 'Tally',             'Accounting Software',  10),
    (_cat_id, 'Quick Books',       'Accounting Software',  20),
    (_cat_id, 'Vyapar',            'Accounting Software',  30),
    (_cat_id, 'Odoo',              'Accounting Software',  40),
    (_cat_id, 'ERPnext',           'Accounting Software',  50),
    -- Others (alphabetical)
    (_cat_id, 'Bookkeeper',        'Accounting Software', 100),
    (_cat_id, 'Bookkeeper App',    'Accounting Software', 110),
    (_cat_id, 'Busy',              'Accounting Software', 120),
    (_cat_id, 'Cleartax',          'Accounting Software', 130),
    (_cat_id, 'Deskera',           'Accounting Software', 140),
    (_cat_id, 'EazyPharma',        'Accounting Software', 150),
    (_cat_id, 'Eduflex',           'Accounting Software', 160),
    (_cat_id, 'Focus ERP',         'Accounting Software', 170),
    (_cat_id, 'FreshBooks',        'Accounting Software', 180),
    (_cat_id, 'Genius',            'Accounting Software', 190),
    (_cat_id, 'Ginesys',           'Accounting Software', 200),
    (_cat_id, 'GoFrugal',          'Accounting Software', 210),
    (_cat_id, 'HostBooks',         'Accounting Software', 220),
    (_cat_id, 'JustBilling',       'Accounting Software', 230),
    (_cat_id, 'KDK Spectrum',      'Accounting Software', 240),
    (_cat_id, 'Khatabook',         'Accounting Software', 250),
    (_cat_id, 'Logic ERP',         'Accounting Software', 260),
    (_cat_id, 'Marg ERP',          'Accounting Software', 270),
    (_cat_id, 'MyBillBook',        'Accounting Software', 280),
    (_cat_id, 'MyClassCampus',     'Accounting Software', 290),
    (_cat_id, 'Oracle NetSuite',   'Accounting Software', 300),
    (_cat_id, 'Petpooja',          'Accounting Software', 310),
    (_cat_id, 'Posist',            'Accounting Software', 320),
    (_cat_id, 'ProfitBooks',       'Accounting Software', 330),
    (_cat_id, 'QuickFile',         'Accounting Software', 340),
    (_cat_id, 'Ramco ERP',         'Accounting Software', 350),
    (_cat_id, 'Reach Accountant',  'Accounting Software', 360),
    (_cat_id, 'Redbook',           'Accounting Software', 370),
    (_cat_id, 'SAP',               'Accounting Software', 380),
    (_cat_id, 'Saral Accounts',    'Accounting Software', 390),
    (_cat_id, 'TaxCloud India',    'Accounting Software', 400),
    (_cat_id, 'Torqus',            'Accounting Software', 410),
    (_cat_id, 'Wave',              'Accounting Software', 420),
    (_cat_id, 'Winman',            'Accounting Software', 430),
    (_cat_id, 'Xero',              'Accounting Software', 440)
  ON CONFLICT (category_id, name) DO NOTHING;

  -- ==========================================================================
  -- Tools → group = "Other Tools" (15)
  -- ==========================================================================
  INSERT INTO template_tools (category_id, name, "group", sort_order) VALUES
    (_cat_id, 'Microsoft Excel',                  'Other Tools', 1000),
    (_cat_id, 'Google Sheets',                    'Other Tools', 1010),
    (_cat_id, 'Microsoft Word',                   'Other Tools', 1020),
    (_cat_id, 'Google Docs',                      'Other Tools', 1030),
    (_cat_id, 'PowerPoint',                       'Other Tools', 1040),
    (_cat_id, 'Gmail / Outlook',                  'Other Tools', 1050),
    (_cat_id, 'WhatsApp Business',                'Other Tools', 1060),
    (_cat_id, 'Slack',                            'Other Tools', 1070),
    (_cat_id, 'Google Drive',                     'Other Tools', 1080),
    (_cat_id, 'Dropbox',                          'Other Tools', 1090),
    (_cat_id, 'Zoom / Google Meet',               'Other Tools', 1100),
    (_cat_id, 'Adobe Acrobat (PDF)',              'Other Tools', 1110),
    (_cat_id, 'Canva',                            'Other Tools', 1120),
    (_cat_id, 'Razorpay / PayU',                  'Other Tools', 1130),
    (_cat_id, 'Digital signature (emSigner / DSC)', 'Other Tools', 1140)
  ON CONFLICT (category_id, name) DO NOTHING;

  -- ==========================================================================
  -- AI Tools (15)
  -- ==========================================================================
  INSERT INTO template_ai_tools (category_id, name, sort_order) VALUES
    (_cat_id, 'ChatGPT',                  0),
    (_cat_id, 'Claude',                  10),
    (_cat_id, 'Google Gemini',           20),
    (_cat_id, 'Microsoft Copilot',       30),
    (_cat_id, 'Perplexity',              40),
    (_cat_id, 'Zoho Zia',                50),
    (_cat_id, 'QuickBooks Intuit Assist', 60),
    (_cat_id, 'Docyt',                   70),
    (_cat_id, 'Vic.ai',                  80),
    (_cat_id, 'Booke AI',                90),
    (_cat_id, 'Dext',                   100),
    (_cat_id, 'Nanonets',               110),
    (_cat_id, 'Klippa',                 120),
    (_cat_id, 'Notion AI',              130),
    (_cat_id, 'Otter.ai',               140)
  ON CONFLICT (category_id, name) DO NOTHING;
END $$;
