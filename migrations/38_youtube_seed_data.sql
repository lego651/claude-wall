-- Seed: YouTube channels (30 channels across 4 categories)
INSERT INTO youtube_channels (channel_id, channel_name, category) VALUES
  -- prop_firm_official
  ('UCkgCjFPlUbOLPxMGLQlNS5w', 'FundedNext',            'prop_firm_official'),
  ('UCW3_q_GFRMeldAFy0TW0LGg', 'FTMO',                  'prop_firm_official'),
  ('UCp9gCQzMZXTXE1ZmDTmBrSA', 'The5ers',               'prop_firm_official'),
  ('UCTy0VCCH9aSgKdpD2RBoFhg', 'TopstepTV',             'prop_firm_official'),
  ('UC5nVPP3zKT9d7aJlEyB3uFg', 'FundingPips',           'prop_firm_official'),
  ('UCO_WT9i6YMmYMmh0sLgq80w', 'Apex Trader Funding',   'prop_firm_official'),
  ('UC8JD3apZAFBb_OStVq_Wm3g', 'Earn2Trade',            'prop_firm_official'),
  ('UCf6-7VuMxaS7zWuPz_pVVjw', 'True Forex Funds',      'prop_firm_official'),
  ('UCzmNNRdopK_VilGHLwzJJXg', 'BluFX Trading',         'prop_firm_official'),

  -- prop_firm_review
  ('UCn4FWyY1M4MH-JN0SWFk5VA', 'Those Who Trade',       'prop_firm_review'),
  ('UC3YF4BO0C5LUfNRVy9HkxRQ', 'Prop Firm Reviews',     'prop_firm_review'),
  ('UCCEgn0AjHSGHREJNK6Nt8Vg', 'Funded Trader Reviews', 'prop_firm_review'),
  ('UCMibFmNmVEDXpuITJ82GWsA', 'The Funded Trader HQ',  'prop_firm_review'),

  -- industry_news
  ('UCvJJ_dzjViJCoLf5uKUTwoA', 'CNBC',                  'industry_news'),
  ('UCIALMKvObZNtJ6AmdCLP7Lg', 'Bloomberg Markets',     'industry_news'),
  ('UCT3d9BBSMgEXHJnJ3HQCEDA', 'Reuters',               'industry_news'),
  ('UCCmBLOMNaEK-WdLE4eLhbSQ', 'Real Vision Finance',   'industry_news'),
  ('UCVHyfQSGWA9mkrO4Y5ZKK6Q', 'Macro Voices',          'industry_news'),
  ('UC0ICUPv4vbHBHNR2VlAqHcA', 'Tasty Trade',           'industry_news')
ON CONFLICT (channel_id) DO NOTHING;

-- Seed: YouTube keywords (10 keywords)
INSERT INTO youtube_keywords (keyword) VALUES
  ('prop firm trading 2024'),
  ('funded trader review'),
  ('prop firm challenge'),
  ('forex prop firm'),
  ('futures prop firm'),
  ('FTMO review'),
  ('funded trading account'),
  ('best prop firm 2024'),
  ('prop firm payout'),
  ('trading challenge tips')
ON CONFLICT (keyword) DO NOTHING;
