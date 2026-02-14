/**
 * PROP-025: Load test for propfirm detail endpoints
 * Run: k6 run tests/load/firm-detail.js
 * Optional: BASE_URL=... FIRM_ID=fundingpips k6 run tests/load/firm-detail.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const FIRM_ID = __ENV.FIRM_ID || 'fundingpips';
const VUS = parseInt(__ENV.VUS || '10', 10);
const DURATION = __ENV.DURATION || '1m';

export const options = {
  vus: Math.min(Math.max(VUS, 1), 500),
  duration: DURATION,
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<6000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const chartUrl = `${BASE_URL}/api/v2/propfirms/${FIRM_ID}/chart?period=30d`;
  const resChart = http.get(chartUrl, { tags: { name: 'chart-30d' } });
  check(resChart, { 'chart status 200': (r) => r.status === 200 });

  sleep(0.3);

  const topUrl = `${BASE_URL}/api/v2/propfirms/${FIRM_ID}/top-payouts?period=30d`;
  const resTop = http.get(topUrl, { tags: { name: 'top-payouts' } });
  check(resTop, { 'top-payouts status 200': (r) => r.status === 200 });

  sleep(0.3);

  const latestUrl = `${BASE_URL}/api/v2/propfirms/${FIRM_ID}/latest-payouts`;
  const resLatest = http.get(latestUrl, { tags: { name: 'latest-payouts' } });
  check(resLatest, { 'latest-payouts status 200': (r) => r.status === 200 });

  sleep(0.3);

  const signalsUrl = `${BASE_URL}/api/v2/propfirms/${FIRM_ID}/signals?days=30`;
  const resSignals = http.get(signalsUrl, { tags: { name: 'signals' } });
  check(resSignals, { 'signals status 200': (r) => r.status === 200 });

  sleep(0.3);

  const incidentsUrl = `${BASE_URL}/api/v2/propfirms/${FIRM_ID}/incidents?days=90`;
  const resIncidents = http.get(incidentsUrl, { tags: { name: 'incidents' } });
  check(resIncidents, { 'incidents status 200': (r) => r.status === 200 });

  sleep(0.5);
}
