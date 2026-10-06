# Career presentation and loading

This is a frontend-only Career presentation update. Sporting rules, event
definitions, eligibility, week advancement, scoring, migrations, database
contents and API startup are unchanged. No merge or deployment is included.

## Presentation

- Five icon-led navigation destinations, with clearer active and contextual
  tabs. Career navigation stays in-flow on phones rather than overlapping the
  existing TKDL mobile navigation.
- Bundled public-domain Natural Earth 1:50m land outlines replace the coarse
  hand-drawn map. Geographic anchors, qualification routes and discovery
  filters remain authoritative API data; outlines are illustrative.
- Map legends, controls, selected-event panel and typography are coordinated.
  Phone filters start collapsed so the map is not pushed below a long form.
- Marker hit areas remain 48 screen pixels across zoom levels. Keyboard
  selection, arrow-key panning, the accessible location list and reduced
  motion remain supported. Dragging uses the SVG coordinate transform to
  handle letterboxing correctly.

The geography generator is an optional developer script, never a build or
startup command. The generated SVG ships locally without an external map
service or tracking request. Natural Earth data is public domain:
https://www.naturalearthdata.com/about/terms-of-use/

## Loading

The closed Attention panel no longer initiates finance, life and sporting
summary reads. Other screens still request summaries they genuinely need.
Ordinary reads have a 30-second client freshness window instead of 10 seconds.
Successful or failed mutations still invalidate the entire save and save list.
Live session freshness remains 2 seconds and tournament freshness remains 0.
HTTP no-store and all server authorization remain unchanged.

These changes reduce unnecessary and repeated reads; they do not remove
Render Free cold starts or establish a measured production latency improvement.

## Verification and release gate

- 60 local Career UI regression tests pass, including cache policy and mocked
  mutation invalidation tests.
- Focused typecheck passes: `pnpm exec tsc -p artifacts/tkdl/tsconfig.career-ui.json --noEmit`.
- Local interactive Chromium checks pass at 320, 360, 390, 768, 1024 and 1440
  pixels: no horizontal overflow or fixed Career bottom bar, 44px toolbar
  controls, 48px marker hit areas, keyboard/pointer interaction and reduced motion.
- Local request interception verifies three deferred reads, no extra reads
  on a warm reopen after 20 seconds, and refetches after save invalidation.
  All data is fictional test data; zero production requests.
- The complete production frontend bundle passed with optional gzip-size
  reporting disabled through Vite's programmatic build API. The frontend's
  normal `build` script uses this same path, with the setting also explicit
  in `vite.config.ts`. The earlier CLI build reached gzip reporting after
  emitting assets, then exceeded this workspace's memory limit.
- The API production build passed without starting the server or connecting
  to a database. Neither build invoked Render or a production URL.
- Browser verification of the shared app bar passes at 320, 390, 768, 1023
  and 1024 pixels on a Career subpage: fixed and flush to the viewport bottom
  below 1024 pixels, with the live ticker hidden until desktop widths.
- An optional build-only GitHub workflow template is provided in
  `artifacts/tkdl/scripts/career-ui-checks.yml.template`. It is not installed
  because this conversation's GitHub connection lacks the OAuth `workflow`
  scope; it is not a release requirement after the local production builds.
