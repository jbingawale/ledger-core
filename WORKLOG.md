# WORKLOG

Append-only. Entries are written by `npm run log` at the moment the work happens;
commit hashes are attached by `npm run log:commit` immediately after each commit.
Nothing in this file is back-filled.

<!-- entry ts=2026-09-02T17:36:25+05:30 -->
## 2026-09-02 17:36 - Setup

_first entry_

- Repo initialised: zero-dependency Node ESM project, node:test as the runner.
- Scaffolded README.md, NUMBERS.md, AMBIGUITIES.md, REJECTED.md with section headings.
- Built tools/worklog.mjs so the log is timestamped at write time, not reconstructed later.

<!-- entry ts=2026-09-02T17:47:31+05:30 -->
## 2026-09-02 17:47 - Planning

_11m since previous entry_

- Wrote PLAN.md breaking the build into ten steps, one commit each.
- Ordered the steps so money and rounding are settled before any balance logic is written.

<!-- entry ts=2026-09-02T17:51:39+05:30 -->
## 2026-09-02 17:51 - Step 1 - Money

_4m since previous entry_

- Built src/money.js: amounts held as whole minor units, AED at 2 places and BHD at 3, frozen values, no decimal numbers anywhere inside.
- Money.of only accepts text. Passing a plain JS number is refused, because by then the language has already rounded it.
- Amounts finer than the currency can hold are rejected rather than silently rounded.
- 13 tests pass, including a thousand additions of 0.01 AED landing exactly on 10.00.
- Fixed the test script: node --test needs a glob on this Node version, a bare directory was read as a file name.
