-- ============================================================================
-- Seed firms.trustpilot_url (single source of truth for Trustpilot scraper)
-- ============================================================================
-- The scraper reads from firms WHERE trustpilot_url IS NOT NULL.
-- Edit these in Supabase (or run UPDATEs) to add/change links.

UPDATE firms SET trustpilot_url = 'https://www.trustpilot.com/review/fundednext.com' WHERE id = 'fundednext';
UPDATE firms SET trustpilot_url = 'https://www.trustpilot.com/review/the5ers.com' WHERE id = 'the5ers';
UPDATE firms SET trustpilot_url = 'https://www.trustpilot.com/review/fundingpips.com' WHERE id = 'fundingpips';
UPDATE firms SET trustpilot_url = 'https://www.trustpilot.com/review/alphacapitalgroup.com' WHERE id = 'alphacapitalgroup';
UPDATE firms SET trustpilot_url = 'https://www.trustpilot.com/review/blueguardian.com' WHERE id = 'blueguardian';
UPDATE firms SET trustpilot_url = 'https://www.trustpilot.com/review/aquafunded.com' WHERE id = 'aquafunded';
UPDATE firms SET trustpilot_url = 'https://www.trustpilot.com/review/instantfunding.com' WHERE id = 'instantfunding';
UPDATE firms SET trustpilot_url = 'https://www.trustpilot.com/review/fxify.com' WHERE id = 'fxify';

-- FTMO and TopStep already have trustpilot_url in 13_add-ftmo-topstep.sql
