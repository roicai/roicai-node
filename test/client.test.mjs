import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ApiError, createClient } from '../dist/index.js';

// Returns a fetch that records each request and answers with `status` and `body`.
function fakeFetch(status, body) {
  const requests = [];
  const fetch = async (input, init) => {
    const request = new Request(input, init);
    requests.push(request);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, requests };
}

test('sends requests to api.roic.ai with the token as a Bearer header', async () => {
  const { fetch, requests } = fakeFetch(200, { id: 'tkr_1', symbol: 'NASDAQ:AAPL' });
  const roicai = createClient({ token: 'key_123', fetch });

  await roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' });

  assert.equal(requests[0].url, 'https://api.roic.ai/v3.0.0/tickers/NASDAQ%3AAAPL');
  assert.equal(requests[0].headers.get('authorization'), 'Bearer key_123');
});

test('sends requests to another baseUrl when given one', async () => {
  const { fetch, requests } = fakeFetch(200, { data: [] });
  const roicai = createClient({ token: 'key_123', baseUrl: 'http://localhost:3008', fetch });

  await roicai.fundamentals.ratios.credit.list({ identifier: 'NASDAQ:AAPL', limit: 1 });

  assert.equal(requests[0].url, 'http://localhost:3008/v3.0.0/fundamental/ratios/credit/NASDAQ%3AAAPL?limit=1');
});

test('returns fields in camelCase with dates as ISO strings', async () => {
  const { fetch } = fakeFetch(200, {
    data: [{ id: 'evt_1', symbol: 'NASDAQ:AAPL', period_end_date: '2025-09-27', created_at: '2025-10-30T20:30:00Z' }],
  });
  const roicai = createClient({ token: 'key_123', fetch });

  const events = await roicai.companyEvents.list({ limit: 1 });

  assert.equal(events.data[0].periodEndDate, '2025-09-27');
  assert.equal(events.data[0].createdAt, '2025-10-30T20:30:00Z');
});

test('throws an ApiError with the status of a failed request', async () => {
  const { fetch } = fakeFetch(404, { error: { type: 'not_found_error', message: 'No ticker matches.' } });
  const roicai = createClient({ token: 'key_123', fetch });

  await assert.rejects(roicai.tickers.retrieve({ identifier: 'NASDAQ:NOPE' }), (err) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.status, 404);
    return true;
  });
});
