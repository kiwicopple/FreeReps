#!/usr/bin/env bash
# Private, consistent logical backup. Does not stop or modify the live database.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
repo_dir="$PWD"
backup_dir="$repo_dir/backups/postgres"
container="${PROTOCOL_DB_CONTAINER:-freereps-local-db-1}"

for dependency in docker git shasum; do
  command -v "$dependency" >/dev/null || { echo "Missing dependency: $dependency" >&2; exit 1; }
done
for folder in "$repo_dir/backups" "$backup_dir"; do
  if [[ -L "$folder" ]]; then echo 'Refusing a symlinked backup directory.' >&2; exit 1; fi
  mkdir -p "$folder"
  chmod 700 "$folder"
done
if ! git check-ignore -q backups/postgres/privacy-check; then
  echo 'Backup directory must be ignored by Git.' >&2; exit 1
fi
if [[ -n "$(git ls-files -- backups)" ]]; then
  echo 'Refusing to back up into a directory with tracked files.' >&2; exit 1
fi
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
partial="$(mktemp "$backup_dir/.partial-$stamp-XXXXXX")"
log="$partial.log"
trap 'rm -f "$partial"' EXIT
if ! docker exec "$container" pg_dump -U freereps -d freereps --format=custom > "$partial" 2> "$log"; then
  echo "Backup failed; private diagnostic log: $log" >&2; exit 1
fi
if [[ ! -s "$partial" ]] || ! docker exec -i "$container" pg_restore --list < "$partial" > /dev/null 2>> "$log"; then
  echo "Backup archive verification failed; private diagnostic log: $log" >&2; exit 1
fi
suffix="${partial##*-}"
archive="$backup_dir/protocol-$stamp-$suffix.dump"
# Publish without ever overwriting an older archive, even on a name collision.
ln "$partial" "$archive"
rm -f "$partial"
shasum -a 256 "$archive" | sed "s|$backup_dir/||" > "$archive.sha256"
rm -f "$log"
trap - EXIT
printf 'Backup created (UTC): %s\n' "$archive"
printf 'Archive catalog verified; SHA-256 recorded. No backups automatically deleted.\n'
