import {
  type Client as GeneratedClient,
  type ClientOptions as GeneratedClientOptions,
  createClient as createGeneratedClient,
} from './generated/index.js';
import { type Paginated, paginate } from './pagination.js';

export * from './generated/index.js';
export type { Page, PagePromise, Paginated } from './pagination.js';

/**
 * The URL of the ROIC.ai API.
 */
export const DEFAULT_BASE_URL = 'https://api.roic.ai';

/**
 * The options of a client: your API key as `token`, and optionally a `baseUrl`,
 * `fetch`, `headers` or `query` to send with every request.
 */
export interface ClientOptions extends Omit<GeneratedClientOptions, 'baseUrl'> {
  /**
   * The URL the paths of the API are relative to. Defaults to {@link DEFAULT_BASE_URL}.
   */
  baseUrl?: string;
}

/**
 * A client of the ROIC.ai API. Its list methods return a {@link PagePromise}:
 * await it for the first page, or iterate it with `for await` for every item.
 */
export type Client = Paginated<GeneratedClient>;

/**
 * Returns a client of the ROIC.ai API.
 *
 * ```ts
 * const roicai = createClient({ token: process.env.ROICAI_API_KEY! });
 * const ticker = await roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' });
 * for await (const price of roicai.stockPrices.list({ identifier: 'NASDAQ:AAPL', dateGte: '2025-01-01' })) {
 *   console.log(price.date, price.close);
 * }
 * ```
 */
export function createClient(options: ClientOptions): Client {
  return paginate(createGeneratedClient({ ...options, baseUrl: options.baseUrl ?? DEFAULT_BASE_URL }));
}
