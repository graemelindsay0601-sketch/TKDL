---
name: Career visual audit
description: Reliable browser capture criteria for Career routes and save states.
---

For visual audits, wait for the route content to mount and its primary loading state to settle, then inspect the inner content panel at the top, middle, and bottom. An initial absence of loading placeholders can happen before React mounts and is not proof that the route is ready. The Career shell keeps document height at the viewport while its main panel may contain many screens; a document-only full-page screenshot misses that content.

A visual review is not complete merely because routes and interactions work. A claimed improvement must be present in production components/styles and shown at the rendered route. The user wants each changed Career page reviewed and approved individually before any push to main; never push pending that sign-off. The signed-in Career UI fixture can fail when its schema migrations lag dependencies of current Career services (observed missing sponsorship tables); do not treat an unauthenticated screenshot as a page review.

**Why:** A mobile Career page had 8,411 pixels of scrollable main content while the document reported only 900 pixels; a fixed delay captured loading, and checking for zero placeholders too early captured before content mounted. The user also found that a prior route/interaction audit did not make the requested pages visibly better, and asked to approve each page before the team pushes.

**How to apply:** In browser automation, locate and scroll the Career content panel itself, not `window`/`document`; wait for visible loading placeholders to clear. Scope failed-request checks to Career APIs because isolated preview harnesses may not host unrelated global endpoints. Present each changed page for explicit individual sign-off; do not push changes to main until every page is approved.
