# WORKLOG

Append-only. Entries are written by `npm run log` at the moment the work happens;
commit hashes are attached by `npm run log:commit` immediately after each commit.
Nothing in this file is back-filled.

<!-- entry ts=2026-09-02T17:36:25+05:30 -->
## 2026-09-02 17:36 — Setup

_first entry_

- Repo initialised: zero-dependency Node ESM project, node:test as the runner.
- Scaffolded README.md, NUMBERS.md, AMBIGUITIES.md, REJECTED.md with section headings.
- Built tools/worklog.mjs so the log is timestamped at write time, not reconstructed later.

<!-- entry ts=2026-09-02T17:47:31+05:30 -->
## 2026-09-02 17:47 — Planning

_11m since previous entry_

- Wrote PLAN.md breaking the build into ten steps, one commit each.
- Ordered the steps so money and rounding are settled before any balance logic is written.
