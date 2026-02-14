import { getFirmLogoUrl, DEFAULT_LOGO_URL } from '@/lib/logoUtils';

describe('logoUtils', () => {
  describe('DEFAULT_LOGO_URL', () => {
    it('is /icon.png', () => {
      expect(DEFAULT_LOGO_URL).toBe('/icon.png');
    });
  });

  describe('getFirmLogoUrl', () => {
    it('returns firm.logo when set', () => {
      expect(getFirmLogoUrl({ id: 'f1', logo: 'https://cdn.example/f1.png' })).toBe(
        'https://cdn.example/f1.png'
      );
    });

    it('returns firm.logo_url when set', () => {
      expect(getFirmLogoUrl({ firm_id: 'f1', logo_url: 'https://supabase.co/storage/f1.webp' })).toBe(
        'https://supabase.co/storage/f1.webp'
      );
    });

    it('returns firm.logoPath when set', () => {
      expect(getFirmLogoUrl({ id: 'f1', logoPath: '/custom/path.png' })).toBe('/custom/path.png');
    });

    it('returns DEFAULT_LOGO_URL when no logo', () => {
      expect(getFirmLogoUrl({ id: 'f1' })).toBe(DEFAULT_LOGO_URL);
      expect(getFirmLogoUrl({})).toBe(DEFAULT_LOGO_URL);
      expect(getFirmLogoUrl(null)).toBe(DEFAULT_LOGO_URL);
    });

    it('returns DEFAULT_LOGO_URL when logo is empty string', () => {
      expect(getFirmLogoUrl({ id: 'f1', logo: '' })).toBe(DEFAULT_LOGO_URL);
      expect(getFirmLogoUrl({ id: 'f1', logo_url: '  ' })).toBe(DEFAULT_LOGO_URL);
    });

    it('trims whitespace from url', () => {
      expect(getFirmLogoUrl({ id: 'f1', logo: '  https://x.com/logo.png  ' })).toBe(
        'https://x.com/logo.png'
      );
    });
  });
});
