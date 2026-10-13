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
