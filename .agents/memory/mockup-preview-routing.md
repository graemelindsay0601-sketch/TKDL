---
name: Mockup preview routing
description: Non-obvious routing and stale-frame behavior for the workspace mockup sandbox.
---

For canvas previews from the mockup sandbox, use `https://$REPLIT_DEV_DOMAIN/__mockup/preview/<group>/<Component>`. Do not append the sandbox port: `/__mockup` is already routed to the sandbox, while adding `:8081` bypasses that route and produces a blank frame. A missing-component error can also persist in an existing iframe even after the source file appears in the registry; when this happens, verify the served generated registry, restart the sandbox, and use a fresh component route/iframe rather than repeatedly toggling the old frame.

**Why:** The workspace's root dev domain can serve the main app, while the mockup server is available through a path-based proxy. A direct port URL and a stale iframe can therefore show misleading errors even when the local preview renders.

**How to apply:** When debugging a canvas preview, check the `/__mockup/src/.generated/mockup-components.ts` route for the target key, confirm the component module is served beneath `/__mockup`, and keep the canvas iframe URL on the path-based preview route.
