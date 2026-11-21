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
  `answers.json`.
- Speed, measured on this VM (Node 24, 1.5 shared CPUs, practice set):
  parse-only median about 140 ms per set against about 450 ms for the
  house baseline; end-to-end driver median about 0.84 s against about
  1.60 s for the baseline driver. Numbers vary with VM load; see the
  build report for the measurement conditions.

## License

MIT
