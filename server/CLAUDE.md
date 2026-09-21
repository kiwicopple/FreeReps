# Server Development

- Build: `cd server && make build` (or `make build` from root)
- Test: `cd server && go test ./...`
- Frontend stub for Go build: `mkdir -p server/web/dist && touch server/web/dist/.gitkeep`
- Frontend build: `cd server/web && npm ci && npm run build`
- Daily review regression checks: `cd server/web && npm test` (Node 24 in the
  container, or a local Node with TypeScript stripping). These protect Singapore
  day boundaries, missing-data handling and sleep wake-date assignment.

## Daily review

The home route is a focused daily review; the configurable all-metrics dashboard
remains at `/overview`. The daily review uses explicit `Asia/Singapore` dates,
hourly API buckets regrouped into days, and completed-day activity comparisons.
Sleep is assigned to the local wake date and includes completed sleep ending
today. Keep this distinction: UTC session labels can put a night on the previous
calendar date. Do not replace absent measurements with zero or join sparse
weight points into a continuous trend. Per-panel request failures must remain
visible rather than looking like missing measurements.

## Integration tests

`go test ./...` skips them. They need a PostgreSQL server in `FREEREPS_TEST_DSN`
and run with `-tags integration`. CI does not run them.

The deployed database publishes no port outside its compose network, so the DSN
points at a scratch container. Docker Desktop is installed on the development
Mac — its CLI is not on the PATH a tool call inherits, so call it by path:

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
docker run -d --name freereps-scratch \
  -e POSTGRES_DB=freereps_scratch -e POSTGRES_USER=freereps \
  -e POSTGRES_PASSWORD=scratch -p 55432:5432 \
  timescale/timescaledb:latest-pg16

FREEREPS_TEST_DSN='postgres://freereps:scratch@localhost:55432/freereps_scratch?sslmode=disable' \
  go test -tags integration ./...
```

Where Docker is unavailable, the same container runs on the homelab host behind
a tunnel:

```bash
ssh root@freereps-lxc 'docker run -d --name freereps-idem \
  -e POSTGRES_PASSWORD=scratch -e POSTGRES_USER=freereps -e POSTGRES_DB=freereps_idem \
  -p 127.0.0.1:15432:5432 timescale/timescaledb:latest-pg16'
ssh -f -N -L 15432:127.0.0.1:15432 root@freereps-lxc
ssh root@freereps-lxc 'docker rm -f freereps-idem'   # and kill the tunnel
```

The helper refuses to run against a database named `freereps`, because it
truncates. *Why the scratch server rather than a fake:* the property these tests
check is enforced by a unique constraint, so a fake store would assert the
fake's behaviour — see the 2026-08-10 entry in [`INCIDENTS.md`](../INCIDENTS.md).

**Rehearsing a data migration.** The same container takes a restore of the
deployed data, which is how the two dedupe migrations were checked before they
ran in production: `pg_dump --data-only --table=workout_sets` from
`freereps-db-1`, load it into a database that has the migrations applied up to
the one under test, then run the binary with `-migrate-only` from a directory
holding a `migrations/` copy and a config pointing at the scratch server.
