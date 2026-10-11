# Private local backups

Run from the repository root with Docker Desktop running:

```bash
bash tools/backup-db.sh
```

Backups are custom-format `pg_dump` archives in `backups/postgres/`, outside the
Docker database volume. Names contain UTC timestamps and a unique suffix. The
script applies owner-only directory/file permissions (700/600), refuses symlinked
or tracked backup directories, verifies the archive catalog and writes a SHA-256
checksum. It does not interrupt the app or delete old backups. Run it before
risky changes and periodically; no automatic schedule is installed yet.

The dump contains all database tables, including health readings, food logs,
chat text and connection credentials. Treat it as secret. File permissions are
not encryption. The directory is ignored by Git; never force-add its contents.

Verify a checksum from inside the backup directory with
`shasum -a 256 -c <archive>.dump.sha256`.

## Restore verification

A full restore was tested in a temporary container using the live database's
exact image, no network, and a disposable in-memory data directory. The restored
chat and food tables were readable; the temporary container was removed afterward.
The private verification log remains under `backups/postgres/`.

For recovery, create a separate database using the matching PostgreSQL/TimescaleDB
version, enable the TimescaleDB extension, call `timescaledb_pre_restore()`, restore
with `pg_restore --exit-on-error --no-owner --no-acl`, and call
`timescaledb_post_restore()`. Do not restore over the live database without a
specific recovery plan. See the [Timescale restore instructions](https://docs.timescale.com/self-hosted/latest/backup-and-restore/logical-backup/).

A database dump does not include Docker configuration, roles, or future attachment
files. Recreate the application database role and keep configuration/attachments
in the private backup plan. This local copy protects against volume loss, but
not loss of the Mac itself. An encrypted copy on a separate device/location is
the next step; no off-device destination has been configured.

## Git privacy guard

`python3 tools/check-private-files.py` scans the Git index for tracked ignored
files, obvious access tokens, private keys, SQL dumps and Health exports. It runs
in local verification. Enable the commit/push hooks on each clone with:

```bash
git config core.hooksPath .githooks
```

The push hook also scans newly outgoing Git objects, catching a secret added and
removed between commits. These checks cannot identify every secret or prove that
an image is synthetic; review staged changes and use synthetic fixtures only.

## Repository audit

The audit scanned 1,812 reachable historical blobs for secret/export signatures
and matched configured database-held integration credentials in memory against
them. No matching live credential, database dump or Health export was found. The single credential-like
example was a placeholder. No ignored local configuration was tracked.

Inherited screenshots contained an unverified health conversation and personal
server details. The unverified MCP/iOS images were moved to the ignored private
backup area and removed from current documentation. Known demo dashboard images
remain. Old commits still contain the removed images: deleting current files does
not purge Git history or other copies. Rewriting published history requires a
separate coordinated decision. This audit is a focused exposure check, not a
proof that the entire application has no security vulnerabilities.
