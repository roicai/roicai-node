// Calls the real API. Skipped unless ROICAI_API_KEY is set.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createClient } from '../dist/index.js';

const token = process.env.ROICAI_API_KEY;

test('retrieves a ticker from the live API', { skip: !token && 'ROICAI_API_KEY is not set' }, async () => {
  const roicai = createClient({ token });

  const ticker = await roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' });

  assert.equal(ticker.symbol, 'NASDAQ:AAPL');
});

test('lists income statements from the live API', { skip: !token && 'ROICAI_API_KEY is not set' }, async () => {
  const roicai = createClient({ token });

  const statements = await roicai.fundamentals.incomeStatements.list({ identifier: 'NASDAQ:AAPL', limit: 1 });

  assert.equal(statements.data.length, 1);
  assert.equal(statements.data[0].symbol, 'NASDAQ:AAPL');
});

test('pages through a list from the live API', { skip: !token && 'ROICAI_API_KEY is not set' }, async () => {
  const roicai = createClient({ token });

  const tickers = await roicai.tickers.list({ limit: 2 }).autoPagingToArray({ limit: 5 });

  assert.equal(tickers.length, 5);
  assert.equal(new Set(tickers.map((t) => t.id)).size, 5);
});

test('filters stock prices by a date range on the live API', { skip: !token && 'ROICAI_API_KEY is not set' }, async () => {
  const roicai = createClient({ token });

  const prices = await roicai.stockPrices
    .list({ identifier: 'NASDAQ:AAPL', dateGte: '2025-01-01', dateLte: '2025-01-31', limit: 5 })
    .autoPagingToArray({ limit: 100 });

  assert.ok(prices.length > 15);
  assert.ok(prices.every((p) => p.date >= '2025-01-01' && p.date <= '2025-01-31'));
});
