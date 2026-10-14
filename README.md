# ROIC.ai Node.js SDK

TypeScript and JavaScript client for the [ROIC.ai](https://roic.ai) financial data API: tickers, prices, fundamentals, ratios, earnings calls, company events and bulk downloads.

## Install

```sh
npm install roicai
```

Requires Node.js 20 or later. It also runs in Bun.

## Usage

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

Methods are grouped the way the API's URLs are: `/v3.0.0/fundamental/ratios/credit/{identifier}` is `roicai.fundamentals.ratios.credit.list(...)`. Each group has `list`, `retrieve` or `search`.

Identifiers are an exchange and symbol separated by a colon (`NASDAQ:AAPL`), a ticker ID (`tkr_...`) or a FIGI.

### Fields and dates

Fields are camelCase (`periodEndDate`), where the API's JSON is snake_case (`period_end_date`). Dates and timestamps are ISO 8601 strings; pass them to `new Date()` when you need a `Date`.

### Errors

A request that fails throws an `ApiError` with the HTTP `status` and the API's error in `details`:

```ts
import { ApiError } from 'roicai';

try {
  await roicai.tickers.retrieve({ identifier: 'NASDAQ:NOPE' });
} catch (err) {
  if (err instanceof ApiError && err.status === 404) {
    // no such ticker
  }
}
```

### Options

| Option | Default | |
|---|---|---|
| `token` | required | Your API key, sent as `Authorization: Bearer <token>`. |
| `baseUrl` | `https://api.roic.ai` | |
| `fetch` | global `fetch` | |
| `headers` | | Sent with every request. |

Each method also takes `RequestOptions` as its last argument, such as an `AbortSignal`.

## Development

The client in `src/generated` is generated from the API's OpenAPI document with [forge](https://github.com/cloudflare/forge). Don't edit it by hand: CI regenerates it from `openapi.json` and fails on any difference.

```sh
npm ci
npm run build
npm test                          # set ROICAI_API_KEY to also run the live tests
```

To regenerate, install jq and forge at the pinned commit, then run the script:

```sh
cargo install --git https://github.com/cloudflare/forge --rev "$(cat .forge-version)" forge
npm run generate                  # from https://api.roic.ai/openapi.json
npm run generate -- ./spec.json   # from another document
```

The **Codegen** workflow does this after every API deploy and opens a pull request when the SDK changed. Review the `openapi.json` diff in that pull request: a removed or renamed method, group or field is a breaking change (see [Releasing](#releasing)).

`src/index.ts` is the only hand-written source. It sets the default `baseUrl` and re-exports the generated client.

## Releasing

1. Open a pull request that sets `version` in `package.json` (and `package-lock.json`, with `npm version <version> --no-git-tag-version`). The SDK follows semver: while it is `0.x`, a breaking change needs a new minor version.
2. After it merges, publish a GitHub release whose tag is `v` plus that version, such as `v0.1.0`. Mark it as a pre-release to publish under the `next` tag instead of `latest`.

The **Release** workflow then builds, tests and publishes to npm with a provenance attestation. npm trusts that workflow as the package's publisher, so there is no npm token to rotate.

## License

[MIT](LICENSE)
