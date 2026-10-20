---
name: Career visual audit
description: Reliable browser capture criteria for Career routes and save states.
---

For visual audits, wait for the route's primary loading state to settle and inspect the inner content panel at the top, middle, and bottom. The Career shell keeps document height at the viewport while its main panel may contain many screens; a document-only full-page screenshot misses that content.

**Why:** A mobile Career page had 8,411 pixels of scrollable main content while the document reported only 900 pixels, and a fixed delay initially captured a loading state.

**How to apply:** In browser automation, locate and scroll the Career content panel itself, not `window`/`document`; wait for visible loading placeholders to clear. Scope failed-request checks to Career APIs because isolated preview harnesses may not host unrelated global endpoints.
