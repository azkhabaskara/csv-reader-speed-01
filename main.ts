import { setFlagsFromString } from 'node:v8';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// The house driver turns V8's incremental marking off before solve.js is
// imported; this entry tunes V8's flags the same way.
setFlagsFromString('--no-incremental-marking');

const { run } = await import('./solve.js');

// In the server's sandbox the mounts are /input and /output; a local
// process run may point elsewhere through the environment instead.
const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8'));
const answers = cases.map((c) => run(c.input));
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answers));
