// Type-checked by `npm test` (tsc -p test), never run: each line states a
// type the client must have.
import { createClient, type Page, type PagePromise } from '../src/index.js';

const roicai = createClient({ token: 'key' });

// List methods return a PagePromise: a page when awaited, items when iterated.
const prices = roicai.stockPrices.list({ identifier: 'NASDAQ:AAPL', dateGte: '2025-01-01', dateLte: '2025-01-31' });
const page: Page<{ date: string; close: number }> = await prices;
for await (const price of prices) {
  const close: number = price.close;
}
await prices.autoPagingEach((price) => price.close > 100);
const tickers = await roicai.tickers.search({ query: 'apple' }).autoPagingToArray({ limit: 10 });
const symbol: string = tickers[0]!.symbol;

// Range filters are typed fields.
roicai.fundamentals.incomeStatements.list({ identifier: 'NASDAQ:AAPL', fiscalYearGte: 2020, fiscalYearLte: 2024 });
roicai.stockSplits.list({ identifier: 'NASDAQ:AAPL', dateGt: '2000-01-01' });

// Methods that don't return a page don't page.
const ticker = await roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' });
// @ts-expect-error a ticker has no autoPagingEach
ticker.autoPagingEach;
// @ts-expect-error retrieve doesn't return an async iterable
for await (const item of roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' })) {
}

// The client authenticates with the Bearer header only.
// @ts-expect-error apikey is not a request field
roicai.tickers.list({ apikey: 'key' });

// The logo endpoint returns an image, which the client doesn't cover.
// @ts-expect-error companies has no logos group
roicai.companies.logos;

export type { PagePromise };
