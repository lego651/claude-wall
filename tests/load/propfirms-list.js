/**
 * PROP-025: Load test for GET /api/v2/propfirms
 * Run: k6 run tests/load/propfirms-list.js
 * Optional: BASE_URL=https://your-app.vercel.app k6 run tests/load/propfirms-list.js
 * Optional: VUS=50 DURATION=2m k6 run tests/load/propfirms-list.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const VUS = parseInt(__ENV.VUS || '10', 10);
const DURATION = __ENV.DURATION || '1m';

export const options = {
  vus: Math.min(Math.max(VUS, 1), 1000),
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const url = `${BASE_URL}/api/v2/propfirms?period=1d&sort=totalPayouts&order=desc`;
  const res = http.get(url, { tags: { name: 'propfirms-list-1d' } });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms (1d)': (r) => r.timings.duration < 500,
  });

  sleep(0.5);

  const url7d = `${BASE_URL}/api/v2/propfirms?period=7d`;
  const res7d = http.get(url7d, { tags: { name: 'propfirms-list-7d' } });
  check(res7d, { 'status is 200 (7d)': (r) => r.status === 200 });

  sleep(0.5);
}
