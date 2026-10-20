---
name: Career visual audit
description: Reliable browser capture criteria for Career routes and save states.
---

For visual audits, wait for the route content to mount and its primary loading state to settle, then inspect the inner content panel at the top, middle, and bottom. An initial absence of loading placeholders can happen before React mounts and is not proof that the route is ready. The Career shell keeps document height at the viewport while its main panel may contain many screens; a document-only full-page screenshot misses that content.

**Why:** A mobile Career page had 8,411 pixels of scrollable main content while the document reported only 900 pixels; a fixed delay captured loading, and checking for zero placeholders too early captured before content mounted.

**How to apply:** In browser automation, locate and scroll the Career content panel itself, not `window`/`document`; wait for visible loading placeholders to clear. Scope failed-request checks to Career APIs because isolated preview harnesses may not host unrelated global endpoints.
