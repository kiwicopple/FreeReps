# Server Development

- Build: `cd server && make build` (or `make build` from root)
- Test: `cd server && go test ./...`
- Frontend stub for Go build: `mkdir -p server/web/dist && touch server/web/dist/.gitkeep`
- Frontend build: `cd server/web && npm ci && npm run build`

## Calendar dates and travel

The dashboard sends the device's IANA `timezone` on metric and workout queries.
Date-only bounds then mean local midnight through the next local midnight; use
calendar arithmetic rather than adding 24 hours because DST days vary in length.
Clients omitting the parameter retain UTC. Daily aggregation and cumulative source
selection must use the same zone, or counters spanning midnight can double-count.

Sleep-session dates and food-log dates are recorded calendar labels, not instants.
Keep those labels unchanged during travel. Sleep stages and heart-rate windows use
the session's actual timestamps, which can extend beyond its recorded UTC date.
The UI refreshes its local day/zone on focus, visibility changes and midnight;
query cache keys for instant-based data include the zone. Travel regression tests
use synthetic Pacific, Eastern and Singapore contexts and a scratch database.

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
