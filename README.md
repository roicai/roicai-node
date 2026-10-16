# ROIC.AI Node.js Library

[![Version](https://img.shields.io/npm/v/roicai.svg)](https://www.npmjs.com/package/roicai)
[![Build Status](https://github.com/roicai/roicai-node/actions/workflows/ci.yml/badge.svg)](https://github.com/roicai/roicai-node/actions/workflows/ci.yml)

The ROIC.AI Node.js library is the official TypeScript and JavaScript client for the [ROIC.AI](https://roic.ai) financial data API and stock API. Use it to get fundamentals for public companies, such as income statements, balance sheets, cash flow statements, financial ratios and valuation multiples, and earnings call transcripts. It also covers historical and latest stock prices, SEC filings and other company documents, the earnings calendar, company profiles and forex rates.

## Documentation

See the [ROIC.AI API reference](https://api.roic.ai/v3.0.0/openapi) for every endpoint, parameter and field, and the [API guides](https://www.roic.ai/api) for authentication, plans and response formats.

## Requirements

Node.js 20 or later. The library also runs in Bun.

## Installation

Install the package with:

```sh
npm install roicai
```

## Usage

The library needs your ROIC.AI API key, which you can find on the [authentication page](https://www.roic.ai/api/docs/authentication) once you sign in. Create a client with it:

```ts
import { createClient } from 'roicai';

const roicai = createClient({ token: process.env.ROICAI_API_KEY! });

const ticker = await roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' });

const statements = await roicai.fundamentals.incomeStatements.list({
  identifier: 'NASDAQ:AAPL',
  periodType: 'annual',
  limit: 5,
});

const latest = await roicai.stockPrices.latest.retrieve({ identifier: 'NASDAQ:AAPL' });
```

Or using CommonJS, on Node.js 20.19+ and 22.12+:

```js
const { createClient } = require('roicai');

const roicai = createClient({ token: process.env.ROICAI_API_KEY });

roicai.tickers
  .retrieve({ identifier: 'NASDAQ:AAPL' })
  .then((ticker) => console.log(ticker.name))
  .catch((error) => console.error(error));
```

The package is ESM-only. On older Node.js versions, load it from CommonJS with `await import('roicai')`.

Methods are grouped the way the API's URLs are: `/v3.0.0/fundamental/ratios/credit/{identifier}` is `roicai.fundamentals.ratios.credit.list(...)`. Each group has `list`, `retrieve` or `search`.

Identify a company by its exchange and symbol separated by a colon (`NASDAQ:AAPL`), its ticker ID (`tkr_...`) or its FIGI.

### Usage with TypeScript

The package includes its types. Every request field and response field is typed, with enums as string literal unions:

```ts
import { createClient, type Client } from 'roicai';

type Ticker = Awaited<ReturnType<Client['tickers']['retrieve']>>;

const client: Client = createClient({ token: process.env.ROICAI_API_KEY! });
const msft: Ticker = await client.tickers.retrieve({ identifier: 'NASDAQ:MSFT' });
console.log(msft.status); // "listed" | "delisted" | null
```

### Fields and dates

Fields are camelCase (`periodEndDate`), where the API's JSON is snake_case (`period_end_date`). Dates and timestamps are ISO 8601 strings; pass them to `new Date()` when you need a `Date`.

## Configuration

### Initialize with config object

Pass options to `createClient`:

```ts
const configured = createClient({
  token: process.env.ROICAI_API_KEY!,
  headers: { 'user-agent': 'my-app/1.0' },
});
```

| Option | Default | Description |
|---|---|---|
| `token` | required | Your API key, sent as `Authorization: Bearer <token>`. |
| `baseUrl` | `https://api.roic.ai` | URL that requests are made to. |
| `fetch` | global `fetch` | [Function that sends requests.](#using-a-custom-fetch) |
| `headers` | | Headers sent with every request. |
| `query` | | A `URLSearchParams` sent with every request. |

### Request options

Every method takes `RequestOptions` as its last argument:

| Option | Description |
|---|---|
| `signal` | An `AbortSignal` that cancels the request. |
| `headers` | Headers for this request. They replace the client's headers of the same name. |
| `query` | Query parameters appended to this request. |
| `onResponse` | Called with the `Response` before its body is read. |

### Configuring timeouts

The library sets no timeout. Pass a signal to limit one request:

```ts
const ticker = await roicai.tickers.retrieve(
  { identifier: 'NASDAQ:AAPL' },
  { signal: AbortSignal.timeout(5_000) },
);
```

A request that times out rejects with the signal's reason, a `TimeoutError`. To set a timeout for every request, use a [custom `fetch`](#using-a-custom-fetch).

### Examining responses

Use `onResponse` to read the status and headers, such as the request ID to quote when you contact support:

```ts
await roicai.tickers.retrieve(
  { identifier: 'NASDAQ:AAPL' },
  { onResponse: (response) => console.log(response.status, response.headers.get('request-id')) },
);
```

### Using a custom fetch

Pass your own `fetch` to log, time out, retry or proxy requests. The library doesn't retry failed requests by itself:

```ts
const logged = createClient({
  token: process.env.ROICAI_API_KEY!,
  fetch: async (input, init) => {
    const response = await fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) });
    console.log(init?.method, String(input), response.status);
    return response;
  },
});

await logged.tickers.retrieve({ identifier: 'NASDAQ:MSFT' });
// GET https://api.roic.ai/v3.0.0/tickers/NASDAQ%3AMSFT 200
```

### Date and fiscal year ranges

Lists of dated rows take `dateGte`, `dateGt`, `dateLte` and `dateLt`, with dates as `YYYY-MM-DD`:

```ts
const january = await roicai.stockPrices.list({
  identifier: 'NASDAQ:AAPL',
  dateGte: '2025-01-01',
  dateLte: '2025-01-31',
  order: 'asc',
});
```

They work on stock prices, stock splits, forex prices, earnings calls, the earnings calendar and every fundamentals list. Fundamentals and employee counts also take `fiscalYearGte`, `fiscalYearGt`, `fiscalYearLte` and `fiscalYearLt`:

```ts
const since2020 = await roicai.fundamentals.incomeStatements.list({
  identifier: 'NASDAQ:AAPL',
  periodType: 'annual',
  fiscalYearGte: 2020,
});
```

### Auto-pagination

List methods return one page of up to `limit` rows. You can also have the library fetch the next pages for you as you go. It sends the same request again with the page token from `nextPageUrl`, so every page uses your filters, and it stops after the last page. There are a few ways to do this.

#### Async iterators (`for await`)

```ts
for await (const call of roicai.earningsCalls.list({ identifier: 'NASDAQ:AAPL', limit: 100 })) {
  console.log(call.fiscalYear, call.fiscalQuarter, call.date);
}
```

Use `break` to stop early. The library doesn't request any page after the one you stopped in.

#### `autoPagingEach`

```ts
await roicai.stockPrices.list({ identifier: 'NASDAQ:AAPL', dateGte: '2020-01-01' }).autoPagingEach((price) => {
  console.log(price.date, price.close);
});
```

The callback can return a promise, which the library waits for before the next item. Return `false` to stop.

#### `autoPagingToArray`

This collects the items into an array. It's meant for lists you expect to be small, so you must pass a `limit` of at most 10,000; for more, use one of the methods above:

```ts
const tickers = await roicai.tickers.list({ exchange: 'NASDAQ', limit: 500 }).autoPagingToArray({ limit: 2000 });
```

#### Fetching pages yourself

Awaiting a list gives its first page. To fetch the next page yourself, send the same request with the `page` token from `nextPageUrl`, which is `null` on the last page. A token only works with the filters and `limit` it was issued for.

## Handling errors

A request that fails throws an `ApiError` with the HTTP `status` and the API's error in `details`:

```ts
import { ApiError, type V3Error } from 'roicai';

try {
  await roicai.tickers.retrieve({ identifier: 'NASDAQ:NOPE' });
} catch (err) {
  if (err instanceof ApiError && err.status === 404) {
    // no such ticker
    const { error } = err.details as V3Error;
    console.log(error.code, error.message, error.requestId); // resource_missing ...
  }
}
```

The API returns `401` for a missing or invalid key, `402` when your plan doesn't include the data, `404` for an unknown identifier and `429` when you exceed your rate limit.

## Examples

The examples use the `roicai` client from [Usage](#usage).

### Tickers

Retrieve one ticker, search by symbol or company name, or list tickers with filters:

```ts
const apple = await roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' });
console.log(apple.name, apple.isin, apple.figi);

const bySymbol = await roicai.tickers.search({ query: 'AAPL', limit: 5 });
const byName = await roicai.tickers.search({ query: 'apple', searchBy: 'name', limit: 5 });
const byIsin = await roicai.tickers.search({ query: 'US0378331005', searchBy: 'isin' });
console.log(byName.data.map((t) => t.symbol));

const nasdaq = await roicai.tickers.list({
  exchange: 'NASDAQ',
  type: 'stock',
  status: 'listed',
  limit: 100,
});
const japan = await roicai.tickers.list({ listingCountryCode: 'JP', isPrimary: true });
```

`searchBy` also matches `cik`, `cusip`, `figi` and the other ticker fields exactly.

### Company profile

```ts
const profile = await roicai.companies.profiles.retrieve({ identifier: 'NASDAQ:AAPL' });
console.log(profile.name, profile.sector, profile.industry, profile.ceo);
console.log(profile.earningsSchedule.nextReleaseDate);
```

### Stock prices

Historical daily prices come newest first. Prices are unadjusted unless you set `adjustment` to `splits` or `total_return`:

```ts
const prices = await roicai.stockPrices.list({ identifier: 'NASDAQ:AAPL', limit: 30 });
for (const day of prices.data) {
  console.log(day.date, day.open, day.high, day.low, day.close, day.volume);
}
console.log(prices.currency); // "USD"

const splitAdjusted = await roicai.stockPrices.list({
  identifier: 'NASDAQ:AAPL',
  date: '2020-08-28',
  adjustment: 'splits',
});

const latest = await roicai.stockPrices.latest.retrieve({ identifier: 'NASDAQ:AAPL' });
console.log(latest.date, latest.close);
```

For a date range, see [Date and fiscal year ranges](#date-and-fiscal-year-ranges).

### Financial statements

Income statements, balance sheets and cash flow statements take the same parameters. Set `periodType` to `annual`, `quarterly` or `ttm`, and `periodLabel` to one fiscal period (`FY`, `Q1` to `Q4`):

```ts
const annual = await roicai.fundamentals.incomeStatements.list({
  identifier: 'NASDAQ:AAPL',
  periodType: 'annual',
  limit: 5,
});
for (const year of annual.data) {
  console.log(year.fiscalYear, year.isSalesRevenueTurnover, year.isNetIncome, year.dilutedEps);
}

const quarters = await roicai.fundamentals.balanceSheets.list({
  identifier: 'NASDAQ:AAPL',
  periodType: 'quarterly',
  limit: 4,
});
console.log(quarters.data.map((q) => [q.fiscalYear, q.periodLabel, q.bsTotAsset, q.bsTotLiab]));

const fourthQuarters = await roicai.fundamentals.cashFlowStatements.list({
  identifier: 'NASDAQ:AAPL',
  periodType: 'quarterly',
  periodLabel: 'Q4',
  limit: 4,
});
console.log(fourthQuarters.data.map((q) => [q.fiscalYear, q.cfCashFromOper, q.cfFreeCashFlow]));
```

Rows come newest first. Amounts are in `currency`, and line items use short names: `isSalesRevenueTurnover` is revenue, `bsTotAsset` is total assets and `cfCapExpenditures` is capital expenditures. `roicai.fundamentals.perShareMetrics` and `roicai.fundamentals.enterpriseValues` work the same way.

### Ratios and multiples

Ratios are grouped into `profitability`, `credit`, `liquidity`, `workingCapital` and `yieldAnalysis`. Margins and returns are percentages (`46.9` is 46.9%):

```ts
const profitability = await roicai.fundamentals.ratios.profitability.list({
  identifier: 'NASDAQ:AAPL',
  periodType: 'annual',
  limit: 5,
});
for (const year of profitability.data) {
  console.log(year.fiscalYear, year.grossMargin, year.operMargin, year.returnOnInvCapital);
}

const credit = await roicai.fundamentals.ratios.credit.list({ identifier: 'NASDAQ:AAPL', limit: 1 });
console.log(credit.data[0]?.netDebtToEbitda);

const multiples = await roicai.fundamentals.multiples.list({
  identifier: 'NASDAQ:AAPL',
  periodType: 'quarterly',
  limit: 1,
});
const [last] = multiples.data;
console.log(last?.peRatio, last?.evToTtmEbitda, last?.prToBookRatio, last?.prToFreeCashFlow);
```

### Earnings call transcripts

List a company's earnings calls, then retrieve a transcript by fiscal year and quarter. Free plans can access each company's latest two calls:

```ts
const calls = await roicai.earningsCalls.list({ identifier: 'NASDAQ:AAPL', limit: 8 });
console.log(calls.data.map((c) => [c.fiscalYear, c.fiscalQuarter, c.date]));

const call = await roicai.earningsCalls.retrieve({
  identifier: 'NASDAQ:AAPL',
  fiscalYear: 2026,
  fiscalQuarter: 3,
});
if (Array.isArray(call.transcript)) {
  for (const turn of call.transcript) {
    console.log(`${turn.speaker}: ${turn.text}`);
  }
}

const text = await roicai.earningsCalls.retrieve({
  identifier: 'NASDAQ:AAPL',
  fiscalYear: 2026,
  fiscalQuarter: 3,
  format: 'text',
});
console.log(typeof text.transcript); // "string"
```

By default `transcript` is an array of `{ speaker, text }` turns. With `format: 'text'` it is one string.

Leave out `identifier` to list calls from every company, and filter by `date`, `fiscalYear` or `fiscalQuarter`:

```ts
const sameDay = await roicai.earningsCalls.list({ date: '2026-07-30' });
```

### Earnings calendar

Each event has the release date and session, and the EPS and revenue estimates and actuals:

```ts
const schedule = await roicai.calendar.earnings.list({ identifier: 'NASDAQ:AAPL', limit: 4 });
for (const event of schedule.data) {
  console.log(event.fiscalPeriod, event.releaseDate, event.releaseSession, event.epsEstimate, event.epsActual);
}

const oneDay = await roicai.calendar.earnings.list({ date: '2026-10-28' });
```

### SEC filings and company documents

A company event is one reporting period, with the IDs of its transcripts, call audio, slides and filings, such as 10-Q and 8-K reports. Retrieve a document by ID to get a signed download URL, which needs no API key:

```ts
const events = await roicai.companyEvents.list({ identifier: 'NASDAQ:AAPL', limit: 4 });
const [event] = events.data;
console.log(event?.fiscalYear, event?.fiscalQuarter, event?.releaseDate);

const filing = event?.filings.find((f) => f.form === '10-Q');
if (filing) {
  const download = await roicai.documents.filings.retrieve({ id: filing.id });
  console.log(download.filename, download.url, download.expiresAt);
}

const withSlides = await roicai.companyEvents.list({ identifier: 'NASDAQ:AAPL', content: 'slides' });
```

`roicai.documents.slides`, `audio`, `transcripts.edited` and `transcripts.raw` retrieve the other kinds by ID.

### Forex

Identify a currency pair as `FX:` followed by the base and quote currencies:

```ts
const pairs = await roicai.forexPairs.list({ baseCurrency: 'EUR', quoteCurrency: 'USD' });
const yen = await roicai.forexPairs.list({ search: 'yen' });

const eurusd = await roicai.forexPrices.list({ identifier: 'FX:EURUSD', limit: 30 });
console.log(eurusd.data.map((day) => [day.date, day.close]));

const rate = await roicai.forexPrices.latest.retrieve({ identifier: 'FX:EURUSD' });
console.log(rate.date, rate.close);

const toUsd = await roicai.forexPrices.latest.list({ quoteCurrency: 'USD' });
```

## Support

Report bugs and request features in [GitHub issues](https://github.com/roicai/roicai-node/issues). For questions about your account, plan or the data, contact ROIC.AI through [roic.ai](https://roic.ai).

The library follows semver. While it is `0.x`, a minor version can include breaking changes, so pin the minor version you use.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) to build and test the library, regenerate it from the API, and release it.

## License

[MIT](LICENSE)
