#!/usr/bin/env bash

set -euo pipefail

package_path="apps/vscode-extension/package.json"
current_version="$(node -p "require('./apps/vscode-extension/package.json').version")"
previous_package="$(mktemp)"

write_result() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf 'should_release=%s\n' "$1" >> "$GITHUB_OUTPUT"
  else
    printf 'should_release=%s\n' "$1"
  fi
}

cleanup() {
  rm -f "$previous_package"
}

trap cleanup EXIT

if git show "HEAD~1:$package_path" > "$previous_package" 2>/dev/null; then
  previous_version="$(node -e "const fs = require('node:fs'); const packageJson = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(packageJson.version);" "$previous_package")"
else
  previous_version="0.0.0"
fi

if [ "$current_version" = "$previous_version" ]; then
  write_result false
  exit 0
fi

tag="vscode-extension-v$current_version"

if git ls-remote --tags origin 2>/dev/null | grep -q "refs/tags/$tag$"; then
  write_result false
  exit 0
fi

write_result true
