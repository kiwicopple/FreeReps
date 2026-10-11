#!/usr/bin/env bash
# Local release gate. Tests use synthetic fixtures, never the live health database.
set -euo pipefail
cd "$(dirname "$0")/.."
repo_dir="$PWD"

for dependency in node npm docker python3; do
  command -v "$dependency" >/dev/null || { echo "Missing dependency: $dependency" >&2; exit 1; }
done
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Use Node 24 or newer (for example: nvm use 24)."); process.exit(1); }'
docker info >/dev/null

echo 'Checking documentation'
tools/check-docs.sh --all
echo 'Installing locked frontend dependencies and checking the UI'
(
  cd server/web
  npm ci
  npm run build
  npm test
  npm run test:e2e -- --workers=2
)

echo 'Checking Go build, vet, and unit tests'
docker run --rm \
  -v "$repo_dir:/src" \
  -v protocol-go-build:/root/.cache/go-build \
  -v protocol-go-modules:/go/pkg/mod \
  -w /src/server golang:1.27 \
  sh -c 'go build ./... && go vet ./... && go test ./...'

echo 'Checking Go lint'
docker run --rm \
  -v "$repo_dir:/src" \
  -v protocol-go-build:/root/.cache/go-build \
  -v protocol-go-modules:/go/pkg/mod \
  -w /src/server golangci/golangci-lint:v2.13.2 \
  golangci-lint run ./...

echo 'Local verification passed. No deployment or push was performed.'
