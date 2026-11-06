// Moonless comparison captures: builds the same smoke scene at two night-light factors.
// This is a release-review helper, not a game control. It restores the selected 50% default last.
// It calls npm through its current Node CLI on Windows, where spawning npm.cmd
// directly can fail before a status exists; stale dist is never accepted.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

const run = (label, command, args, env = process.env) => {
  const r = spawnSync(command, args, { stdio: 'inherit', env });
  if (r.error) throw new Error(label + ' could not start: ' + r.error.message);
  if (r.signal || r.status !== 0) throw new Error(label + ' failed' + (r.signal ? ' by signal ' + r.signal : ' with exit ' + r.status));
};
const npm = process.env.npm_execpath ? [process.execPath, [process.env.npm_execpath]] : [process.platform === 'win32' ? 'npm.cmd' : 'npm', []];
const build = env => run('build', npm[0], [...npm[1], 'run', 'build'], env);
const checkBuild = factor => {
  const html = readFileSync('dist/driftwood.html', 'utf8');
  if (!html.includes('0.29.11') || !html.includes('Moonless')) throw new Error('build for ' + factor + ' left a stale version in dist/driftwood.html');
  console.log('Moonless ' + factor + ': verified dist v0.29.11 · Moonless');
};
for (const [name, factor] of [['moonless-35', '0.35'], ['moonless-50', '0.5']]) {
  const env = { ...process.env, VITE_NIGHT_LIGHT: factor };
  console.log('\nMoonless ' + factor + ': building'); build(env); checkBuild(factor);
  console.log('Moonless ' + factor + ': full smoke'); run('full smoke', process.execPath, ['scripts/smoke.js', '--full'], env);
  if (existsSync(name)) rmSync(name, { recursive: true, force: true });
  mkdirSync(name);
  for (const shot of ['smoke-1.png', 'smoke-10.png', 'smoke-11.png', 'smoke-12.png', 'smoke-27.png', 'smoke-28.png', 'smoke-29.png']) cpSync(shot, `${name}/${shot}`);
}
