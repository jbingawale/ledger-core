#!/usr/bin/env node
// Append-only work log helper. The log is never rewritten, only appended to --
// same discipline as the ledger it documents.
//
//   npm run log -- "<phase>" "<note>" ["<note>" ...]   append a timestamped entry
//   npm run log:commit                                 attach the latest commit to the last entry

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FILE = 'WORKLOG.md';
const MARKER = /<!-- entry ts=(\S+) -->/g;

const pad = (n) => String(n).padStart(2, '0');

function localStamp(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const hh = pad(Math.floor(Math.abs(off) / 60));
  const mm = pad(Math.abs(off) % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${hh}:${mm}`;
}

function human(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function read() {
  return existsSync(FILE) ? readFileSync(FILE, 'utf8') : '';
}

function lastStamp(body) {
  const all = [...body.matchAll(MARKER)];
  return all.length ? new Date(all[all.length - 1][1]) : null;
}

function elapsed(from, to) {
  if (!from) return 'first entry';
  const mins = Math.round((to - from) / 60000);
  if (mins < 60) return `${mins}m since previous entry`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m since previous entry`;
}

function add(args) {
  const [phase, ...notes] = args;
  if (!phase) {
    console.error('usage: npm run log -- "<phase>" "<note>" ["<note>" ...]');
    process.exit(1);
  }
  const now = new Date();
  const body = read();
  const entry = [
    ``,
    `<!-- entry ts=${localStamp(now)} -->`,
    `## ${human(now)} - ${phase}`,
    ``,
    `_${elapsed(lastStamp(body), now)}_`,
    ``,
    ...(notes.length ? notes.map((n) => `- ${n}`) : ['- (no notes)']),
    ``,
  ].join('\n');

  writeFileSync(FILE, body + entry);
  console.log(`worklog: appended "${phase}" at ${human(now)}`);
}

function commit() {
  const line = execSync('git log -1 --pretty=format:%h %s', { encoding: 'utf8' }).trim();
  const body = read();
  if (!body.trim()) {
    console.error('worklog: nothing logged yet -- run `npm run log` first');
    process.exit(1);
  }
  if (body.includes(`commit: \`${line.split(' ')[0]}\``)) {
    console.log('worklog: that commit is already recorded');
    return;
  }
  const hash = line.split(' ')[0];
  const subject = line.slice(hash.length + 1);
  writeFileSync(FILE, `${body.replace(/\s+$/, '')}\n- commit: \`${hash}\` ${subject}\n`);
  console.log(`worklog: attached ${hash}`);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'add') add(rest);
else if (cmd === 'commit') commit();
else {
  console.error('usage: worklog.mjs add "<phase>" "<note>"... | worklog.mjs commit');
  process.exit(1);
}
