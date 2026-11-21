# csv-reader-speed-01

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/azkhabaskara/csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/azkhabaskara/csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A fast drop-in replacement for csv-reader 1.0.0, written for the
[make.fun competition "Read broken CSV files faster, 21 November 2026"](https://make.fun/bounty/csv-reader-speed-01-run-20261121).
It returns answers identical to csv-reader 1.0.0 on every case — same
columns, rows and errors, including all the broken-row cases
(`short_row`, `long_row`, `quote_junk`, `stray_cr`,
`unterminated_quote`) — in less CPU time.

## How it works

One left-to-right pass, no character-by-character loop:

- Per record, look ahead to the next line break. When the record holds
  no quote and no stray CR it is a plain line: each field costs a single
  `indexOf(',')` plus one slice.
- Records with quotes or stray CRs take the general path, where every
  field is found with `indexOf` scans and sliced whole, and the next CR
  is tracked once per record so fields without one cost only two
  `indexOf` calls.
- Quoted spans are sliced whole; line breaks inside them are counted
  only when the span actually contains one, and junk after a closing
  quote is only scanned when there is any.
- Answers are built straight into the result arrays — no temporary
  per-row arrays.

## Layout

- `solve.js` — dependency-free ES module. `run({ text, header })`
  returns `{ columns, rows, errors }`, exactly csv-reader 1.0.0's
  answer for the input.
- `main.ts` — the driver the harness runs. It reads every case from
  `/input/cases.json`, answers each with `run`, and writes
  `/output/answers.json`. It turns V8's incremental marking off before
  importing `solve.js`, the same way the house driver does.

## Verification (practice set, 6 cases, 10.2 MB)

- Gate: 6/6 cases identical to csv-reader 1.0.0
  (`grade-local`, process driver: `cases_passed: 6, passed: 1`).
- Determinism: repeated executions produce byte-identical
  `answers.json` (grade-local: "L1 regrade reproduced byte for byte");
  the driver's `answers.json` is also byte-identical to the house
  baseline driver's output on the same input.
- Speed, measured on this VM (Node 24.22.1, 1.5 shared CPUs, practice
  set, quiet window, load average 0.2–0.8). The number depends on what
  is counted, so all four are reported honestly:
  - Parse only, steady state (warm-up + 11 rounds in one process,
    `--no-incremental-marking`, CPU time): baseline median 749 ms,
    this entry 196 ms, about 3.8x. Wall medians 531 ms vs 143 ms,
    about 3.7x.
  - Parse only, fresh process per pass (includes JIT and the
    `cases.json` parse, no answer stringify): baseline median
    968 ms CPU, this entry 501 ms CPU, about 1.9x.
  - Whole driver end to end (fresh `node main.ts`, includes JSON
    parse and stringify): baseline median 1.60 s wall, this entry
    1.01 s wall, about 1.6x.
  - The harness times CPU net of a do-nothing control, which removes
    the shared fixed costs (startup, JSON parse/stringify). The
    harness figure is therefore expected between the fresh-process
    and steady-state numbers, most plausibly about 2.5–3.1x. The
    rank-1 claim of 3.6x is unverified; this entry does not claim
    to beat it.

## License

MIT
