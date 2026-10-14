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

test('decodes the error of a status the operation does not list', async () => {
  const { fetch } = fakeFetch(403, {
    error: { type: 'authentication_error', code: 'forbidden', message: 'Forbidden.', request_id: 'req_1' },
  });
  const roicai = createClient({ token: 'key_123', fetch });

  await assert.rejects(roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' }), (err) => {
    assert.equal(err.status, 403);
    assert.equal(err.message, 'Forbidden.');
    assert.equal(err.details.error.requestId, 'req_1');
    return true;
  });
});

test('authenticates only with the Bearer header', async () => {
  const { fetch, requests } = fakeFetch(200, { data: [], next_page_url: null, previous_page_url: null });
  const roicai = createClient({ token: 'key_123', fetch });

  // The API rejects a request with both the header and the apikey query parameter.
  await roicai.tickers.list({ apikey: 'key_123', limit: 1 });

  assert.equal(new URL(requests[0].url).search, '?limit=1');
});

test('has no logos group, since the logo endpoint returns an image', () => {
  const roicai = createClient({ token: 'key_123' });

  assert.equal('logos' in roicai.companies, false);
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

// Returns a fetch that answers each request with the next of `bodies`.
function pagedFetch(bodies) {
  const requests = [];
  const fetch = async (input, init) => {
    requests.push(new Request(input, init));
    const body = bodies[requests.length - 1];
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, requests };
}

const pages = [
  { data: [{ symbol: 'A' }, { symbol: 'B' }], next_page_url: '/v3.0.0/tickers?limit=2&page=t2', previous_page_url: null },
  { data: [{ symbol: 'C' }, { symbol: 'D' }], next_page_url: 'https://api.roic.ai/v3.0.0/tickers?page=t3', previous_page_url: null },
  { data: [{ symbol: 'E' }], next_page_url: null, previous_page_url: null },
];

test('awaiting a list gives its first page', async () => {
  const { fetch, requests } = pagedFetch(pages);
  const roicai = createClient({ token: 'key_123', fetch });

  const page = await roicai.tickers.list({ limit: 2 });

  assert.deepEqual(page.data.map((t) => t.symbol), ['A', 'B']);
  assert.equal(page.nextPageUrl, '/v3.0.0/tickers?limit=2&page=t2');
  assert.equal(requests.length, 1);
});

test('iterating a list follows every page with the same request and the next page token', async () => {
  const { fetch, requests } = pagedFetch(pages);
  const roicai = createClient({ token: 'key_123', fetch });

  const symbols = [];
  for await (const ticker of roicai.tickers.list({ limit: 2, exchange: 'NASDAQ' })) {
    symbols.push(ticker.symbol);
  }

  assert.deepEqual(symbols, ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(
    requests.map((r) => new URL(r.url).search),
    ['?exchange=NASDAQ&limit=2', '?exchange=NASDAQ&limit=2&page=t2', '?exchange=NASDAQ&limit=2&page=t3']
  );
});

test('autoPagingEach stops when the callback returns false', async () => {
  const { fetch, requests } = pagedFetch(pages);
  const roicai = createClient({ token: 'key_123', fetch });

  const symbols = [];
  await roicai.tickers.list({ limit: 2 }).autoPagingEach(async (ticker) => {
    symbols.push(ticker.symbol);
    return ticker.symbol !== 'C';
  });

  assert.deepEqual(symbols, ['A', 'B', 'C']);
  assert.equal(requests.length, 2);
});

test('autoPagingToArray returns up to limit items and requires a limit', async () => {
  const { fetch } = pagedFetch(pages);
  const roicai = createClient({ token: 'key_123', fetch });

  const tickers = await roicai.tickers.list({ limit: 2 }).autoPagingToArray({ limit: 3 });

  assert.deepEqual(tickers.map((t) => t.symbol), ['A', 'B', 'C']);
  await assert.rejects(roicai.tickers.list({ limit: 2 }).autoPagingToArray({}), TypeError);
  await assert.rejects(roicai.tickers.list({ limit: 2 }).autoPagingToArray({ limit: 10_001 }), TypeError);
});

test('autoPagingToArray with an invalid limit leaves no unhandled rejection when the request fails', async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on('unhandledRejection', onUnhandled);
  try {
    const { fetch } = fakeFetch(401, { error: { type: 'authentication_error', message: 'Bad key.' } });
    const roicai = createClient({ token: 'key_123', fetch });

    await assert.rejects(roicai.tickers.list({ limit: 2 }).autoPagingToArray({ limit: 10_001 }), TypeError);
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.deepEqual(unhandled, []);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('a list that autoPagingToArray rejected still rejects when awaited', async () => {
  const { fetch } = fakeFetch(401, { error: { type: 'authentication_error', message: 'Bad key.' } });
  const roicai = createClient({ token: 'key_123', fetch });

  const tickers = roicai.tickers.list({ limit: 2 });
  await assert.rejects(tickers.autoPagingToArray({ limit: 0 }), TypeError);

  await assert.rejects(tickers, (err) => err instanceof ApiError && err.status === 401);
});

test('stops instead of following a page token twice', async () => {
  const loop = { data: [{ symbol: 'A' }], next_page_url: '/v3.0.0/tickers?page=same', previous_page_url: null };
  const { fetch, requests } = pagedFetch([loop, loop, loop]);
  const roicai = createClient({ token: 'key_123', fetch });

  const tickers = await roicai.tickers.list({}).autoPagingToArray({ limit: 100 });

  assert.equal(tickers.length, 2);
  assert.equal(requests.length, 2);
});

test('sends range filters under their API names', async () => {
  const { fetch, requests } = fakeFetch(200, { data: [], next_page_url: null, previous_page_url: null });
  const roicai = createClient({ token: 'key_123', fetch });

  await roicai.stockPrices.list({ identifier: 'NASDAQ:AAPL', dateGte: '2025-01-01', dateLt: '2025-02-01' });
  await roicai.fundamentals.incomeStatements.list({ identifier: 'NASDAQ:AAPL', fiscalYearGte: 2020 });

  assert.equal(new URL(requests[0].url).search, '?date.gte=2025-01-01&date.lt=2025-02-01');
  assert.equal(new URL(requests[1].url).search, '?fiscal_year.gte=2020');
});
