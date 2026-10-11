# One-conversation food chat

Implemented 2026-10-11. `/chat` is the first desktop/mobile navigation item. The
existing Today route remains `/`; mobile retains its existing destinations plus
Chat. There is one saved conversation per authenticated user, not a thread list.

## First use

Open Chat and use **Connect OpenAI** to enter an OpenAI API key. API billing is
separate from a ChatGPT subscription. The key goes to the server over the app's
private HTTPS connection; it is never returned by the API or put in browser
storage. **Connection** replaces the key. Existing account authentication applies.

Type a meal, choose photos, or use the camera button. Explicitly say what was
eaten to log it. A menu, planned meal or uncaptioned photo prompts discussion or
clarification rather than implying consumption. Each message can log one eating
event with multiple items; recent entries can be corrected in conversation.
Nutrition links lead to the saved meal's actual recorded day, including historical
meals. The phone supplies the current local date and IANA timezone at send time.

This is a deliberately limited first version: no streaming, voice, thread
management, provider browsing, deletion of food records, or access to sleep,
workouts and other health measurements. It sends recent food logs, today's logged
totals, the nutrient catalog and up to 16 recent turns as context. It does not
claim to remember the entire conversation. History can load older messages.

## Provider and data boundaries

`internal/chat` calls the OpenAI Responses API with `gpt-5-mini`, image inputs,
`store: false`, and strict structured output for the full food record, including nutrient names and
provenance enums. The server assigns canonical nutrient units. One automatic
repair attempt handles cross-field validation errors before any food write.
Only controlled validation rule codes are logged, never meal data. The output
contains a reply and an optional food proposal. It has no unrestricted tools, SQL access or credentials
in model context. User text and image/food content are untrusted input. Package
labels take precedence over model estimates. Unknown nutrients remain absent;
photo portions and nutrient amounts are explicitly estimates, not measurements.

The browser scales images to at most 1600px, re-encodes JPEG to remove EXIF/GPS,
and sends at most three images per turn. Server validation limits actual image
format, bytes and dimensions. Images remain transient request data: Protocol
stores text, image count and a request digest, not photo files. OpenAI still
processes the supplied images and its own API data policies apply. Do not claim
`store: false` disables every provider retention mechanism.

Migration 35 adds `chat_credentials` and `chat_turns`. As with the existing
integration credentials, the API key is in the private application database;
protect the database and backups. Nothing belongs in Git. Credentials, message
bodies, food context, images and raw provider errors must not be logged.
Chat routes reject cross-site requests, remove the legacy permissive CORS header,
and return `Cache-Control: no-store`.

## Save and retry contract

- `GET /api/v1/chat?before=<sequence>` returns up to 50 turns, chronologically,
  a configured boolean and pagination state; no key, request digest or proposal.
- `PUT /api/v1/chat/connection` takes `{api_key}`. Empty disconnects. Saving checks
  syntax; the first actual message checks provider access and quota.
- `POST /api/v1/chat` takes `{id,message,images,timezone,local_date}`. The browser
  retains the same UUID and exact payload on retry after uncertain failures.
- A per-user Postgres advisory lock serializes messages. A reused ID with changed
  content is rejected. A completed request returns its original result.
- The provider proposal passes the existing strict `DecodeFood` validation.
  New records receive a stable server-assigned UUID. Corrections must match a
  supplied recent record's ID/version; deletion is unsupported.
- Persist the proposal before applying it through `SaveFoodEntry`. That existing
  idempotent/versioned API preserves history and reopens affected completed days.
  Complete the turn only after save confirmation. A later send recovers prepared
  proposals without asking the model to generate a second meal.
- Known generation/validation failures automatically leave the draft editable.
  There is one Send action. Unknown save failures keep the message identity and
  lock editing until Send confirms its status, preventing duplicate meals.
- The composer sits below an independently scrolling conversation, above mobile
  navigation. Its viewport height adjusts to the software keyboard. Failed
  pending turns are hidden once their editable draft is restored.

No food, health-calculation or ingestion contract changes. The additive chat
migration is compatible with rolling back the app image; do not drop chat tables
to roll back because they contain the user's conversation.

## Verification

All fixtures are invented. Provider requests are intercepted by a local mock;
Postgres integration checks require exactly `freereps_scratch`. Browser tests
block every unhandled application API call and all external requests.

Checks cover API/image validation, provider errors/refusals, key/user isolation,
new food and correction payloads, replay and interrupted-save recovery, paging,
camera/gallery processing, historical links, US local days, connection setup,
error draft preservation, keyboard controls, both themes and overflow from
320–1440px in Chromium/WebKit. No real meals are posted during live smoke checks.

Physical iPhone camera/HEIC behavior, keyboard resizing and home-screen safe areas
still require a real-device check; WebKit emulation is not that check. A real OpenAI call with a synthetic best-guess meal also passed food validation
on 2026-10-11 without writing to the live nutrition log.

### Estimate validation follow-up — 2026-10-11

The initial schema constrained `food_record_json` only as a string, leaving its
contents outside Structured Outputs validation. A reported 502 reached the food
validator after a completed provider response. The rejected payload was not
retained and its exact failing field cannot be recovered from the old logs.
The replacement uses a typed food object and named nutrient array, canonical
server-assigned units, and one bounded repair for semantic validation failures.
Synthetic tests exercise invalid portion metadata and preserve strict ranges,
provenance and correction versions. A real-provider synthetic estimate passed
without a production food write. This does not make model estimates measurements.

### Mobile keyboard viewport

The mobile chat surface is fixed to the visual viewport, tracking both its height
and vertical offset. Keyboard detection retains the pre-keyboard height because
standalone iOS can shrink `innerHeight` too. Only conversation history scrolls;
new replies never scroll the outer document. The composer uses a 16px input font
to avoid Safari focus zoom. Browser regression coverage simulates simultaneous
height changes and viewport panning, plus keyboard dismissal and draft retention.
Physical iPhone keyboard behavior still requires device verification.

### Photo-estimate validation repair

A two-photo request reached estimate validation, then failed both attempts with
`invalid_reason`. That legacy code covered meal/notes length, reason text, and
expected version, so the exact rejected field cannot be recovered. The provider
schema now bounds descriptive strings, defines short meal/audit fields, and the
chat adapter distinguishes these validation failures with actionable repair
instructions. Existing food validation remains unchanged; no truncation or
nutrition-value substitution is used. Tests cover all five text/version cases
and confirm both images survive the bounded retry. An isolated real-provider
check read two synthetic package/label images, calculated half a labelled
serving, and passed food validation without writing to the food log.

### Verbose local diagnostics

Set `PROTOCOL_CHAT_VERBOSE=1` on the app container while iterating. Remove it or
set it to `0` to disable verbose chat events. No global debug switch is needed.
Each HTTP attempt gets a random trace identifier connecting request stages,
photo count/encoded size, provider attempt/status/timing, token counts,
validation rule, and prepare/save/replay outcomes. Logs do not include messages,
photos, food records, credentials, raw errors or provider response bodies.
Inspect with `docker logs --since 30m freereps-local-app-1 2>&1` and filter for
`chat diagnostic`. Local deployment configuration remains ignored by Git.
