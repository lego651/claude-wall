/**
 * Tests for GET/POST /api/propfirms
 */
import { GET, POST } from './route';
import fs from 'fs';

jest.mock('fs');

describe('/api/propfirms', () => {
  const mockFirms = { firms: [{ id: 'ftmo', name: 'FTMO', addresses: [] }] };

  beforeEach(() => {
    jest.clearAllMocks();
    fs.readFileSync.mockReturnValue(JSON.stringify(mockFirms));
    fs.writeFileSync.mockImplementation(() => {});
  });

  describe('GET', () => {
    it('returns firms from JSON file', async () => {
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.firms).toHaveLength(1);
      expect(body.firms[0].id).toBe('ftmo');
    });

    it('returns empty firms when file read fails', async () => {
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.firms).toEqual([]);
    });
  });

  describe('POST', () => {
    it('returns 400 when name is missing', async () => {
      const req = new Request('https://example.com/api/propfirms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Name is required');
    });

    it('returns 400 when firm with same name exists', async () => {
      const req = new Request('https://example.com/api/propfirms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'FTMO' }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/already exists/);
    });

    it('returns 201 and creates firm', async () => {
      const req = new Request('https://example.com/api/propfirms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Firm', addresses: ['0x123'] }),
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.firm.id).toBe('new-firm');
      expect(body.firm.name).toBe('New Firm');
      expect(body.firm.addresses).toEqual(['0x123']);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });
});
