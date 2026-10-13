#!/usr/bin/env bash
# Regenerates src/generated from the ROIC.ai OpenAPI document.
#
#   scripts/generate.sh                  # fetch https://api.roic.ai/openapi.json
#   scripts/generate.sh path/or/url      # another document
#   scripts/generate.sh --committed      # the committed openapi.json, as CI checks
#
# Needs jq and forge on PATH (or FORGE=/path/to/forge), built at the commit in
# .forge-version:
#   cargo install --git https://github.com/cloudflare/forge --rev "$(cat .forge-version)" forge
set -euo pipefail

cd "$(dirname "$0")/.."
source="${1:-https://api.roic.ai/openapi.json}"
forge="${FORGE:-forge}"

sdk_spec="$(mktemp)"
fetched="$(mktemp)"
trap 'rm -f "$sdk_spec" "$fetched"' EXIT

if [[ "$source" == "--committed" ]]; then
  cp openapi.json "$fetched"
elif [[ "$source" == http* ]]; then
  curl -fsSL "$source" | jq . > "$fetched"
else
  jq . "$source" > "$fetched"
fi

# forge skips operations without SDK names, so a document without any would
# generate an empty SDK and delete every method.
named="$(jq '[.paths[][] | objects | select(has("x-fern-sdk-group-name"))] | length' "$fetched")"
if [[ "$named" == 0 ]]; then
  echo "generate: no operation in $source has x-fern-sdk-group-name; refusing to generate an empty SDK" >&2
  exit 1
fi
cp "$fetched" openapi.json

# forge types date and date-time fields as Temporal objects, which Node only
# ships from v26 and TypeScript only types from v6. Without the formats they are
# ISO 8601 strings, which work on every runtime and compiler.
jq 'walk(if type == "object" and (.format == "date-time" or .format == "date") then del(.format) else . end)' \
  openapi.json > "$sdk_spec"

# forge overwrites the files it generates but leaves others alone, so a group
# removed from the API would linger without this.
rm -rf src/generated
"$forge" "$sdk_spec" --target ts --out src/generated
