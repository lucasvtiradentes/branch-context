#!/usr/bin/env bash

set -euo pipefail

read_current_version() {
  node -p "require('./$1').version"
}

read_previous_version() {
  git show "HEAD~1:$1" 2>/dev/null | node -e "const fs = require('node:fs'); try { const packageJson = JSON.parse(fs.readFileSync(0, 'utf8')); process.stdout.write(packageJson.version); } catch { process.stdout.write(''); }"
}

version_changed() {
  local package_path="$1"
  local current_version
  local previous_version

  current_version="$(read_current_version "$package_path")"
  previous_version="$(read_previous_version "$package_path")"

  [ -n "$previous_version" ] && [ "$current_version" != "$previous_version" ]
}

tag_missing() {
  local tag="$1"

  ! git ls-remote --tags origin 2>/dev/null | grep -q "refs/tags/$tag$"
}

write_result() {
  local name="$1"
  local value="$2"

  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf '%s=%s\n' "$name" "$value" >> "$GITHUB_OUTPUT"
  else
    printf '%s=%s\n' "$name" "$value"
  fi
}

should_release_npm=false
should_release_vscode=false

if version_changed "apps/cli/package.json" || version_changed "packages/core/package.json"; then
  should_release_npm=true
fi

vscode_version="$(read_current_version "apps/vscode-extension/package.json")"
if version_changed "apps/vscode-extension/package.json" && tag_missing "vscode-extension-v$vscode_version"; then
  should_release_vscode=true
fi

if [ "$should_release_npm" = "true" ] || [ "$should_release_vscode" = "true" ]; then
  should_release=true
else
  should_release=false
fi

write_result should_release "$should_release"
write_result should_release_npm "$should_release_npm"
write_result should_release_vscode "$should_release_vscode"
