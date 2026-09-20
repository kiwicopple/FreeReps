# Withings Public API — Wire Format Spec

Derived from the Withings developer guide (Public API integration guide, OAuth
and measure sections) read on 2026-08-05, cross-checked against the constants in
`vangorra/python_withings_api` for the numeric enumerations the guide renders
client-side only. Only the parts FreeReps consumes are documented here.

## Overview

- API host: `https://wbsapi.withings.net`
- Account host (authorization only): `https://account.withings.com`
- Auth: OAuth2 authorization code, header `Authorization: Bearer <access_token>`
- The **Public API** plan requires no contract and no approval. An application is
  registered in the Withings Partner Hub with a redirect URI; the client ID and
  secret are issued immediately.
- FreeReps reads measurements only. Sleep, activity and workouts are covered by
  Oura and Hevy and are not requested.

**Every response carries HTTP 200.** Errors are signalled inside the body:

```json
{ "status": 0, "body": { … } }
```

`status` 0 means success. Any other value is an error and `body` is absent or a
string. A client that branches on the HTTP status code alone treats every error
as a successful empty result — the failure mode is silent data loss, not an
exception.

Known status values FreeReps distinguishes:

| `status` | Meaning | Handling |
|---|---|---|
| `0` | Success | — |
| `401` | Missing or malformed authentication | Treated as unauthorized |
| `601` | Too many requests | Retried on the next sync cycle |
| `2555` | Unspecified server-side error | Logged, retried next cycle |
| `283`, `284`, `286`, `293`, `294` | Token invalid, expired, or revoked | Treated as unauthorized; the user must reconnect |

The numeric list is not exhaustive and the guide documents no complete table.
The client therefore treats every non-zero `status` as an error and only special-
cases the values above.

## OAuth2

### Authorization

```
GET https://account.withings.com/oauth2_user/authorize2
    ?response_type=code
    &client_id=<client_id>
    &redirect_uri=<redirect_uri>
    &scope=user.metrics
    &state=<csrf token>
```

Scopes: `user.info` (account and devices), `user.metrics` (measurements),
`user.activity` (activity, sleep, workouts), `user.sleepevents`. FreeReps
requests `user.metrics` only.

**The authorization code is valid for 30 seconds.** The callback handler must
exchange it immediately; any work that can be deferred belongs after the
exchange.

`mode=demo` may be appended to authorize against a Withings demo account with
synthetic data. Useful for a first end-to-end run without a device.

### Token exchange and refresh

```
POST https://wbsapi.withings.net/v2/oauth2
Content-Type: application/x-www-form-urlencoded

action=requesttoken&grant_type=authorization_code
&client_id=…&client_secret=…&code=…&redirect_uri=…
```

Refresh uses the same endpoint with `grant_type=refresh_token` and
`refresh_token=…` in place of `code`/`redirect_uri`.

Success body:

```json
{
  "status": 0,
  "body": {
    "userid": "12345",
    "access_token": "…",
    "refresh_token": "…",
    "scope": "user.metrics",
    "expires_in": 10800,
    "token_type": "Bearer"
  }
}
```

- **Access token: 3 hours.** Practically every sync cycle refreshes first.
- **Refresh token: 1 year, and it rotates.** Each refresh returns a new refresh
  token; the previous one expires 8 hours after the new one is issued, or
  immediately once the new access token is first used. A refresh whose result is
  not persisted therefore costs the connection — the stored token is dead within
  hours and reconnecting requires the user to walk the consent flow again. The
  new token is written to the database before the new access token is used for
  anything.
- `userid` identifies the Withings account. FreeReps stores it; it is the key
  webhook notifications would arrive under if push is added later.
- **`userid` arrives quoted or as a bare number**, and the encoding changed on
  2026-08-05 from the string shown above to `"userid": 12345`. The field is read
  through `flexString` (`internal/withings/models.go`), which accepts both.
  *Why it matters:* a type mismatch in one field fails the decode of the whole
  token body, and the refresh then returns an error instead of a token pair —
  the failure mode that kept the integration from delivering a single
  measurement for 46 days ([`INCIDENTS.md`](../../INCIDENTS.md), 2026-09-20).

Some Withings integration types (dropship, cellular) require a `nonce` obtained
from `action=getnonce` plus an HMAC-SHA256 signature on token requests. The
guide's Public API page lists `nonce` among the `requesttoken` parameters, while
the widely used third-party clients omit it and work. FreeReps sends no nonce. A
token request rejected with `status` 100 ("missing mandatory parameter") is the
signal that this account's application does require one; the fix is a `getnonce`
call in `internal/withings/token.go` before each token request.

## `POST /measure?action=getmeas`

Form-encoded parameters:

| Parameter | Value |
|---|---|
| `action` | `getmeas` |
| `meastypes` | Comma-separated `meastype` codes |
| `category` | `1` |
| `lastupdate` | Unix seconds; returns everything created or modified since |
| `startdate` / `enddate` | Unix seconds; used for the initial backfill instead of `lastupdate` |
| `offset` | Pagination cursor, echoed from the previous response |

**`category=1` is not optional.** Category 2 returns the user's *goals* — a
target weight entered in the Health Mate app — in the same shape as a
measurement. Omitting the parameter mixes goals into the time series as
plausible-looking values that nothing later can distinguish from a real
measurement.

`lastupdate` filters on server-side modification time, not measurement time. A
measurement edited in the app months after the fact reappears in the delta, which
is the intended behaviour: the row is re-inserted and `ON CONFLICT DO NOTHING`
keeps the original.

Response body:

```json
{
  "updatetime": 1754380800,
  "timezone": "Europe/Berlin",
  "more": false,
  "offset": 0,
  "measuregrps": [
    {
      "grpid": 987654321,
      "attrib": 0,
      "date": 1754377200,
      "created": 1754377260,
      "modified": 1754377260,
      "category": 1,
      "deviceid": "…",
      "measures": [
        { "value": 76543, "type": 1,  "unit": -3 },
        { "value": 1823,  "type": 6,  "unit": -1 }
      ]
    }
  ]
}
```

- **`value` and `unit` encode one number:** `real = value × 10^unit`. Above:
  `76543 × 10⁻³ = 76.543 kg` and `1823 × 10⁻¹ = 18.23 %`.
- **`updatetime` is the value to store as the next `lastupdate`.** Using a
  locally computed timestamp instead makes the delta window depend on clock skew
  between FreeReps and Withings.
- **`more`/`offset` drive pagination.** While `more` is true, repeat the request
  with the returned `offset`.
- **`grpid` groups the measures taken together.** A blood-pressure reading
  arrives as one group holding systolic, diastolic and pulse; a scale step
  arrives as one group holding weight and every body-composition value. All
  measures in a group share the group's `date`, so grouping by rounded timestamp
  is unnecessary — and would be wrong for the three-in-a-row readings a blood
  pressure monitor produces within a few minutes.
- `date` is when the measurement was taken, `created` when it reached Withings.
  FreeReps stores `date`.

### `attrib`

| Value | Meaning |
|---|---|
| `0` | Measured by a device, attributed to this user |
| `1` | Measured by a device, user attribution ambiguous |
| `2` | Entered manually by the user |
| `4` | Entered manually during account creation |
| `5` | Measured automatically |
| `7` | Measured by a device and confirmed by the user |
| `8` | Same as an existing device entry for the user |

FreeReps stores every attribution. A household where two people share a scale
produces `attrib = 1` groups that may belong to either person; that is a data
quality question for the Health Mate app to resolve, not something this server
can decide. The value is not stored per row today — if misattributed rows ever
show up in the series, filtering on `attrib` here is the place to fix it.

### `meastype`

Codes FreeReps requests, and the metric each maps to:

| `meastype` | Withings meaning | FreeReps metric | Unit |
|---|---|---|---|
| 1 | Weight | `weight_body_mass` | kg |
| 5 | Fat free mass | `lean_body_mass` | kg |
| 6 | Fat ratio | `body_fat_percentage` | % |
| 8 | Fat mass weight | `fat_mass` | kg |
| 9 | Diastolic blood pressure | `blood_pressure_diastolic` | mmHg |
| 10 | Systolic blood pressure | `blood_pressure_systolic` | mmHg |
| 11 | Heart pulse | `blood_pressure_heart_rate` | bpm |
| 76 | Muscle mass | `muscle_mass` | kg |
| 77 | Hydration | `body_water` | kg |
| 88 | Bone mass | `bone_mass` | kg |

**`meastype` 11 does not map to `heart_rate`.** It is the pulse the blood
pressure cuff records alongside a reading — a single seated measurement. Written
into the same series as the continuous heart rate from Oura and Apple Watch it
would shift every daily average, and the two would no longer be comparable. It
gets its own metric name.

Further codes the API defines and FreeReps does not request: 4 height, 12
temperature, 54 SpO2, 71 body temperature, 73 skin temperature, 91 pulse wave
velocity, 123 VO2max, 135/136/138 ECG intervals, 139 atrial fibrillation.

Availability per metric depends on the device and, for part of the catalogue, on
the API plan. Body composition beyond weight and fat ratio comes from a scale
with impedance measurement; a request for a `meastype` the account has no data
for returns no groups rather than an error.

## Source name

Rows written by this integration carry `source = "Withings"`. Source priority
matches named sources by prefix (`WHERE source LIKE 'Withings%'`, see
`internal/storage/health_metrics.go`), so a Health Auto Export payload whose
HealthKit source name also begins with "Withings" lands in the same priority
bucket and the winner within that bucket is undefined. Check
`SELECT DISTINCT source FROM health_metrics` on an instance before relying on the
ordering.
