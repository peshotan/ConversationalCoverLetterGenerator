---
name: Build and GitHub workflow quirks
description: Environment-specific constraints encountered when validating and publishing this workspace.
---

The full workspace build can require workflow-provided environment values even when package-level builds succeed; validate changed artifacts independently with explicit values when a sibling package blocks the aggregate build.

**Why:** The mockup preview package's Vite configuration requires `PORT` during its build, while the API and web packages can build successfully on their own.

**How to apply:** If `pnpm run build` stops in the mockup package for a missing `PORT`, treat it as an environment/configuration limitation, not an application regression, and run the affected package builds separately.

GitHub connector API calls are rate-limited per Repl, so parallel blob uploads can exceed the limit; prefer a single tree commit with file contents or paced sequential requests.

**Why:** A parallel upload hit the connector's 10 requests-per-second limit before creating a repository mutation.

**How to apply:** Use one tree operation where possible, and pace unavoidable GitHub API calls instead of issuing many concurrent requests.

GitHub proxy publishing is more reliable when authenticated writes are split into simple sequential `proxyFetch` calls rather than one nested helper callback; verify the branch ref and pull-request head separately because PR reads can briefly lag.

**Why:** A durable callback containing a nested request helper failed before the write, while direct sequential blob/tree/commit/ref calls succeeded; the first PR response also returned a stale head.

**How to apply:** Confirm the remote ref before publishing, use straightforward sequential REST calls, and perform a second PR GET after updating the branch.