import { setFlagsFromString } from 'node:v8';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// The house driver turns V8's incremental marking off before solve.js is
// imported; this entry tunes V8's flags the same way.
setFlagsFromString('--no-incremental-marking');

const { run } = await import('./solve.js');

const cases = JSON.parse(readFileSync('/input/cases.json', 'utf8'));
const answers = cases.map((c) => run(c.input));
mkdirSync('/output', { recursive: true });
writeFileSync('/output/answers.json', JSON.stringify(answers));
