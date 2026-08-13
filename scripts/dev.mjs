import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const viteEntrypoint = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const processes = [
  spawn(process.execPath, ['--watch', 'server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, [viteEntrypoint], { stdio: 'inherit' }),
];

function stop() {
  for (const child of processes) if (!child.killed) child.kill();
}

process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
for (const child of processes) child.on('exit', (code) => { if (code && code !== 0) { stop(); process.exit(code); } });
