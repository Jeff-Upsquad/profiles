-- Business accounts can save a default currency. Requirement (brief) forms and
-- other amount fields prefill from it, and talents quote in the currency the
-- business chose.

ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS default_currency TEXT
    CHECK (default_currency IN ('INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'));
