# Fake art-event data

`fake-visit-events.jsonl` is newline-delimited JSON: one normalized collector event per line. It is best for TouchDesigner (a JSON DAT / text stream) and for progressive p5.js parsing.

`fake-visit-events.json` contains the identical events as one JSON array. It is convenient for `loadJSON()` in p5.js.

The fields exactly follow the collector's outbound SSE `data:` payload, rather than Nginx's raw log schema. All addresses, hostnames, agents, timestamps, and values are fictional. `bot_family` is a visual classification hint only; `verification_status` intentionally remains `unverified`.

Regenerate a 48-event sequence (the default):

```powershell
node scripts/generate-fake-art-events.mjs
```

Pass a count to make a longer sequence:

```powershell
node scripts/generate-fake-art-events.mjs 300
```

## Minimal p5.js use

```js
let events;
function preload() { events = loadJSON('/art-data/fake-visit-events.json'); }
function draw() {
  const e = events[frameCount % events.length];
  // e.status, e.bytes_sent, e.request_time_seconds, e.bot_family
}
```

## TouchDesigner use

Load `fake-visit-events.jsonl` into a Text DAT (or read it with a File In DAT), split by line, parse each line as JSON, then map `status`, `bytes_sent`, `request_time_seconds`, and `bot_family` to CHOP channels. Use `timestamp` to reproduce timing: adjacent ISO timestamps are the intended event spacing.
