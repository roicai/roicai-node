import { createClient as createGeneratedClient, type ClientOptions as GeneratedClientOptions } from './generated/index.js';

export * from './generated/index.js';

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
 * Returns a client of the ROIC.ai API.
 *
 * ```ts
 * const roicai = createClient({ token: process.env.ROICAI_API_KEY! });
 * const ticker = await roicai.tickers.retrieve({ identifier: 'NASDAQ:AAPL' });
 * ```
 */
export function createClient(options: ClientOptions) {
  return createGeneratedClient({ ...options, baseUrl: options.baseUrl ?? DEFAULT_BASE_URL });
}
