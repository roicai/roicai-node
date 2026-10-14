# Contributing

This guide is for maintainers of the ROIC.ai Node.js library. To report a bug or request a feature, open a [GitHub issue](https://github.com/roicai/roicai-node/issues).

## Development

The client in `src/generated` is generated from the API's OpenAPI document with [forge](https://github.com/cloudflare/forge). Don't edit it by hand: CI regenerates it from `openapi.json` and fails on any difference.

`src/index.ts` and `src/pagination.ts` are the only hand-written sources. `index.ts` sets the default `baseUrl` and re-exports the generated client. `pagination.ts` makes each `list` and `search` method return a promise that can also be iterated through every page, since forge doesn't generate pagination.

`scripts/generate.sh` changes the document before forge reads it: it removes the date formats, so dates are ISO strings rather than Temporal objects, and it renames query parameters with dots, such as `date.gte`, which forge would leave out. The generated code sends them under their real names. It also removes the `apikey` query parameter, since the client always sends the key as a Bearer header and the API rejects both together; leaves out operations without a JSON response, such as the company logo image; and gives every operation a default `v3.Error` response, so `ApiError.details` is decoded for any error status.

Build and test:

```sh
npm ci
npm run build
npm test                          # set ROICAI_API_KEY to also run the live tests
```

## Regenerating the client

Install jq and forge at the pinned commit, then run the script:

```sh
cargo install --git https://github.com/cloudflare/forge --rev "$(cat .forge-version)" forge
npm run generate                  # from https://api.roic.ai/openapi.json
npm run generate -- ./spec.json   # from another document
scripts/generate.sh --committed   # from the committed openapi.json, as CI does
```

The **Codegen** workflow does this after every API deploy and opens a pull request when the SDK changed. Review the `openapi.json` diff in that pull request: a removed or renamed method, group or field is a breaking change (see [Releasing](#releasing)).

## Releasing

1. Open a pull request that sets `version` in `package.json` (and `package-lock.json`, with `npm version <version> --no-git-tag-version`). The SDK follows semver: while it is `0.x`, a breaking change needs a new minor version.
2. After it merges, publish a GitHub release whose tag is `v` plus that version, such as `v0.1.0`. Mark it as a pre-release to publish under the `next` tag instead of `latest`.

The **Release** workflow then builds, tests and publishes to npm with a provenance attestation. npm trusts that workflow as the package's publisher, so there is no npm token to rotate.
