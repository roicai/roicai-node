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

# forge leaves out query parameters whose names have characters other than
# letters, digits, - and _, such as the range filter date.gte. Rename each one
# with _ for forge (date_gte, which it names dateGte), then put the real name
# back in the queries the generated code sends.
dotted=()
while IFS= read -r name; do
  [[ -n "$name" ]] && dotted+=("$name")
done < <(jq -r '[.paths[][] | objects | .parameters[]? | select(.in == "query" and (.name | test("[^A-Za-z0-9_-]"))) | .name] | unique[]' "$sdk_spec")
for name in "${dotted[@]}"; do
  if [[ "$name" =~ [^A-Za-z0-9_.-] ]]; then
    echo "generate: query parameter $name has a character other than letters, digits, -, _ and ." >&2
    exit 1
  fi
  if jq -e --arg n "${name//./_}" '[.paths[][] | objects | .parameters[]? | select(.in == "query" and .name == $n)] | length > 0' "$sdk_spec" > /dev/null; then
    echo "generate: renaming query parameter $name to ${name//./_} would collide with an existing one" >&2
    exit 1
  fi
done
renamed="$(mktemp)"
jq 'walk(if type == "object" and .in == "query" and (.name | type) == "string" then .name |= gsub("\\."; "_") else . end)' \
  "$sdk_spec" > "$renamed"
mv "$renamed" "$sdk_spec"

# forge overwrites the files it generates but leaves others alone, so a group
# removed from the API would linger without this.
rm -rf src/generated
"$forge" "$sdk_spec" --target ts --out src/generated

for name in "${dotted[@]}"; do
  find src/generated -name client.ts -exec \
    perl -pi -e "s/\"\Q${name//./_}\E\"/\"${name}\"/g if /^ *query: \{/" {} +
done
