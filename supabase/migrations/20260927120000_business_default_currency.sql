-- Business accounts can save a default currency. Requirement (brief) forms and
-- other amount fields prefill from it, and talents quote in the currency the
-- business chose.
--
-- last_brief_currency records the currency of the business's latest brief.
-- SquadHub cards don't link back to the brief that produced them, so card
-- ingest uses it (then default_currency) when a card arrives without one.

ALTER TABLE business_users
  ADD COLUMN IF NOT EXISTS default_currency TEXT
    CHECK (default_currency IN ('INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD')),
  ADD COLUMN IF NOT EXISTS last_brief_currency TEXT
    CHECK (last_brief_currency IN ('INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD'));
