/**
 * A page of a list: its items in `data`, and the URL of the next page, or
 * `null` on the last page.
 */
export interface Page<T> {
  data: T[];
  nextPageUrl: string | null;
}

/**
 * The result of a method that lists: await it for the first page, or iterate
 * it with `for await` for every item of every page, fetching each page as it
 * is reached.
 */
export interface PagePromise<P extends Page<T>, T> extends Promise<P>, AsyncIterable<T> {
  /**
   * Calls `onItem` with every item of every page, in order, and waits for
   * any promise it returns. Stops early when `onItem` returns `false`.
   */
  autoPagingEach(onItem: (item: T) => boolean | void | Promise<boolean | void>): Promise<void>;
  /**
   * Returns the items of every page, up to `limit` of them. `limit` is
   * required and at most 10,000, so a long list can't use up memory; iterate
   * longer lists with `for await` or {@link autoPagingEach}.
   */
  autoPagingToArray(options: { limit: number }): Promise<T[]>;
}

/**
 * The client `C`, with each method that returns a {@link Page} returning a
 * {@link PagePromise} instead.
 */
export type Paginated<C> = {
  [K in keyof C]: C[K] extends (...args: infer A) => Promise<infer P>
    ? P extends Page<infer T>
      ? (...args: A) => PagePromise<P, T>
      : C[K]
    : C[K] extends object
      ? Paginated<C[K]>
      : C[K];
};

const MAX_TO_ARRAY = 10_000;

// The methods whose responses can be pages.
const LIST_METHODS = new Set(['list', 'search']);

/**
 * Returns `client` with its list methods returning {@link PagePromise}s. Each
 * next page is the same request with the `page` token of the previous page's
 * `nextPageUrl`, since the API only accepts a token with the filters it was
 * issued for.
 */
export function paginate<C extends object>(client: C): Paginated<C> {
  return wrap(client, new WeakMap()) as Paginated<C>;
}

function wrap(target: object, cache: WeakMap<object, object>): object {
  const cached = cache.get(target);
  if (cached) return cached;
  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      const value: unknown = Reflect.get(obj, key, receiver);
      if (typeof value === 'function' && typeof key === 'string' && LIST_METHODS.has(key)) {
        return (request?: object, options?: unknown) => {
          const fetchPage = (page?: string) =>
            value.call(obj, page === undefined ? request : { ...request, page }, options) as Promise<unknown>;
          return pagePromise(fetchPage(), fetchPage);
        };
      }
      if (typeof value === 'object' && value !== null) {
        return wrap(value, cache);
      }
      return value;
    },
  });
  cache.set(target, proxy);
  return proxy;
}

function pagePromise(
  first: Promise<unknown>,
  fetchPage: (page: string) => Promise<unknown>
): PagePromise<Page<unknown>, unknown> {
  async function* items(): AsyncGenerator<unknown> {
    let page = await first;
    const seen = new Set<string>();
    for (;;) {
      if (!isPage(page)) {
        throw new TypeError('The response is not a page of a list, so it cannot be iterated.');
      }
      yield* page.data;
      const token = nextToken(page.nextPageUrl);
      // A token already followed would loop forever.
      if (token === null || seen.has(token)) return;
      seen.add(token);
      page = await fetchPage(token);
    }
  }

  async function autoPagingEach(onItem: (item: unknown) => boolean | void | Promise<boolean | void>) {
    for await (const item of items()) {
      if ((await onItem(item)) === false) return;
    }
  }

  async function autoPagingToArray(options: { limit: number }) {
    const limit = options?.limit;
    const invalid =
      !Number.isInteger(limit) || limit < 1
        ? 'autoPagingToArray needs a positive integer limit, such as { limit: 1000 }.'
        : limit > MAX_TO_ARRAY
          ? `autoPagingToArray takes a limit of at most ${MAX_TO_ARRAY}; iterate longer lists with for await or autoPagingEach.`
          : undefined;
    if (invalid !== undefined) {
      // The first page was requested when the list method was called. Nothing
      // awaits it after this throw, so its failure would be an unhandled
      // rejection, which ends the Node.js process.
      first.catch(() => {});
      throw new TypeError(invalid);
    }
    const result: unknown[] = [];
    for await (const item of items()) {
      result.push(item);
      if (result.length >= limit) break;
    }
    return result;
  }

  return Object.assign(first, {
    [Symbol.asyncIterator]: items,
    autoPagingEach,
    autoPagingToArray,
  }) as PagePromise<Page<unknown>, unknown>;
}

function isPage(value: unknown): value is Page<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as Page<unknown>).data) &&
    'nextPageUrl' in value
  );
}

function nextToken(nextPageUrl: string | null): string | null {
  if (!nextPageUrl) return null;
  // The URL may be relative; the base only lets it parse.
  return new URL(nextPageUrl, 'https://api.roic.ai').searchParams.get('page');
}
