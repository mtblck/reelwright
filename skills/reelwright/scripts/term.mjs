// Record a real terminal run for a `terminal` scene: runs a command in a folder and saves the command and
// its output (stdout and stderr, colour codes stripped, at most 40 lines) as JSON.
// Usage: node term.mjs <out.json> [--cwd <repo>] [--show "what the scene types"] -- <command> [args...]
// The scene shows --show as the typed command (default: the command as run), e.g. `npx inlay trace logo.png`
// when the run itself was `node bin/inlay.js trace logo.png`. Point a scene at the file with
// "transcript": "media/term.json"; its own `command` or `output` props still win.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dash = args.indexOf('--');
const out = args[0];
if (!out || dash < 1 || dash === args.length - 1) {
  console.error('usage: node term.mjs <out.json> [--cwd <repo>] [--show "command as typed"] -- <command> [args...]');
  process.exit(1);
}
const opt = (k) => { const i = args.indexOf(k); return i > 0 && i < dash ? args[i + 1] : undefined; };
const [cmd, ...rest] = args.slice(dash + 1);
const r = spawnSync(cmd, rest, {cwd: opt('--cwd') ?? process.cwd(), encoding: 'utf8', timeout: 120000, env: {...process.env, NO_COLOR: '1', FORCE_COLOR: '0'}});
if (r.error) { console.error(`could not run ${cmd}: ${r.error.message}`); process.exit(1); }
const text = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\r(?!\n)/g, '\n');
const output = text.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l, i, a) => l || (i > 0 && i < a.length - 1)).slice(0, 40);
fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
fs.writeFileSync(out, JSON.stringify({command: opt('--show') ?? [cmd, ...rest].join(' '), output}, null, 1));
console.log(`${out}: ${output.length} lines, exit ${r.status}`);
