# TKDL LIVE — Studio Backdrop Handover

For whoever's running the AI image generator. Three images, so all of it can be done in one sitting.

## Why three, not one or eight

The show currently has three visually distinct treatments already built into the code (this isn't new — it's already how the league accent colours, the "breaking" red wash, and the "champion" gold wash work):

1. **Main studio** — every routine segment (desk chat, analysis, results, headlines, spotlight, archive callbacks). This is the physical "set" and it should look like one consistent set, the way a real studio doesn't change its wall art between ordinary segments.
2. **Breaking News** — the "stop everything" moment. Goes full-bleed on screen (no boxed panel over it), so this one needs to hold up as the dominant visual, not just a background tint.
3. **Champion / Title Celebration** — the single biggest moment the show can air. Also full-bleed. Gold and celebratory, reserved for this one moment only (gold is never used anywhere else in the show).

## Shared spec — applies to all three images

- **Format:** JPG or PNG, no transparency needed (it's a full backdrop, nothing sits behind it).
- **Aspect ratio:** 16:9, landscape.
- **Resolution:** minimum 1920×1080. Higher is better — 2560×1440 or 3840×2160 if the generator supports it, since this renders full-bleed on large screens.
- **Render style — this is the part that matters most:** it has to match the presenter portraits already in the show (real, semi-realistic 3D-rendered broadcast-presenter art — not flat illustration, not a real photograph, not stock imagery). If the backdrop looks like a different medium than Chalky and Ton, it'll look like two different projects stapled together. Whatever tool/prompt style got the presenter portraits their look, use the same one here.
- **Palette — use these exact colours, nothing else:**
  - Electric blue: `#0066FF`
  - Magenta/red: `#FF005C`
  - Near-black base: `#06040E` and `#0A0910`
  - Gold/amber: `#FFD24A` — **reserved for the Champion image only.** Don't let gold bleed into the Main or Breaking images.
- **Mood:** dark and moody, broadcast-studio lighting, not brightly lit — white text and UI panels sit on top of this and need contrast to read.
- **No text, no logos, no people** in any of the three. Text and branding are added separately in code; a baked-in logo or made-up text will just have to be cropped out or will clash with the real one.
- **Composition — read this before generating:** this image sits *behind* a virtual desk and, for the Main image only, behind a boxed content panel too. A wide band across the lower-middle of the frame will be covered by the desk, and (Main image only) a large central rectangle will be covered by the on-screen graphic panel. Design each one as an ambient wall/environment that still looks complete with the centre and lower-middle obscured — not a single hero subject placed dead-centre, which would just get hidden. Spread the interesting detail toward the edges and upper portion of the frame.

## Image 1 — Main studio

Used behind every routine segment. This is the one that has to work hardest, since it's on screen the most.

> A moody, cinematic 3D-rendered television broadcast studio backdrop for a darts league TV show, wide 16:9. Dark near-black environment (#06040E) with an oversized, softly blurred dartboard glowing with electric blue (#0066FF) light off to one side of the frame, subtle illuminated monitor panels built into the studio wall showing abstract glowing data (no readable text), thin architectural light strips in electric blue and magenta/red (#FF005C) tracing the walls and ceiling like a modern sports broadcast set, a hint of a wooden oche floor line catching light in the distance, soft volumetric haze. Keep the centre and lower-middle of the frame calmer and darker than the edges, since that area will be covered by other graphics. No text, no logos, no people. Polished, premium Sky Sports/ESPN-studio quality. Stylized semi-realistic 3D render, not a photograph.

Save as: `studio-main.jpg` (or `.png`)

## Image 2 — Breaking News

Used only for the "stop everything" alert moment. This one shows full-frame, so it needs to carry the whole screen on its own.

> A moody, cinematic 3D-rendered television broadcast studio backdrop for a "breaking news" alert moment on a darts league TV show, wide 16:9. Dominant, urgent magenta-red (#FF005C) lighting sweeping across a dark near-black (#06040E) environment, a large dramatically underlit dartboard silhouette glowing red in the background, pulsing light-strip accents along the walls, higher contrast and more intense than an ordinary studio shot — the visual equivalent of a channel cutting to a big story. No text, no logos, no people. Same stylized semi-realistic 3D-render quality as the main studio backdrop, not a photograph.

Save as: `studio-breaking.jpg` (or `.png`)

## Image 3 — Champion / Title Celebration

Used only for the single biggest moment the show can air — a league title being won. Also shows full-frame.

> A celebratory, cinematic 3D-rendered television broadcast studio backdrop for a league-champion, title-winning moment on a darts league TV show, wide 16:9. Warm gold and amber (#FFD24A) light rays sweeping through a dark near-black (#06040E) environment, a large dartboard motif rendered in gleaming gold instead of the usual blue/red, soft falling light particles like gold confetti or embers drifting through the air, triumphant and premium — think trophy-lift lighting on a major sports broadcast. No text, no logos, no people. Same stylized semi-realistic 3D-render quality as the other two backdrops, not a photograph.

Save as: `studio-champion.jpg` (or `.png`)

## When they're ready

Just hand back the three files (attach them here, or drop them in the connected project folder) and say which is which if the filenames change. Wiring them in is a small, self-contained change on this end — swapping the current CSS/SVG dartboard-ring placeholder for these three images — nothing else about the layout needs to change to use them.
