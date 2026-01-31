-- Add FTMO and TopStep to firms table
-- Quick fix for TICKET-002 testing

INSERT INTO firms (id, name, timezone, addresses, website, logo_url, trustpilot_url) VALUES
  ('ftmo', 'FTMO', 'UTC', ARRAY[]::TEXT[], 'https://ftmo.com', '/logos/firms/ftmo.jpeg', 'https://www.trustpilot.com/review/ftmo.com'),
  ('topstep', 'TopStep', 'UTC', ARRAY[]::TEXT[], 'https://topsteptrader.com', '/logos/firms/topstep.jpeg', 'https://www.trustpilot.com/review/topsteptrader.com')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  website = EXCLUDED.website,
  logo_url = EXCLUDED.logo_url,
  trustpilot_url = EXCLUDED.trustpilot_url,
  updated_at = NOW();

-- Verify
SELECT id, name, trustpilot_url FROM firms WHERE id IN ('ftmo', 'topstep');
