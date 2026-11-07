/**
 * KhoaChat — Test Runner
 * Tự động khởi động server, chờ sẵn sàng, chạy test, rồi tắt server.
 * Dùng: npx tsx scripts/run-tests.ts
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4001';
const SERVER_DIR = path.resolve(process.cwd(), 'server');
const WAIT_TIMEOUT_MS = 30_000;   // tối đa 30 giây chờ server
const POLL_INTERVAL_MS = 500;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Thăm dò server cho đến khi phản hồi hoặc hết thời gian */
async function waitForServer(url: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch(url, { signal: ctrl.signal }).catch(() => null);
      clearTimeout(timer);
      if (res) return true;         // bất kỳ phản hồi nào đều được
    } catch {
      // bỏ qua lỗi kết nối, thử lại
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

/** Chạy một lệnh và in stdout/stderr; trả về exit code */
function runScript(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  console.log('\n🔧  Khởi động server tạm thời để kiểm thử...');

  // Khởi động server ở background
  const serverProcess: ChildProcess = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', 'src/index.ts'],
    {
      cwd: SERVER_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    }
  );

  // In log server với prefix để dễ nhận biết
  serverProcess.stdout?.on('data', (d) =>
    process.stdout.write(`  [server] ${d.toString().trim()}\n`)
  );
  serverProcess.stderr?.on('data', (d) =>
    process.stderr.write(`  [server] ${d.toString().trim()}\n`)
  );

  serverProcess.on('error', (err) => {
    console.error('❌ Không thể khởi động server:', err.message);
    process.exit(1);
  });

  // Chờ server sẵn sàng
  console.log(`⏳  Chờ server phản hồi tại ${SERVER_URL} ...`);
  const ready = await waitForServer(SERVER_URL, WAIT_TIMEOUT_MS);

  if (!ready) {
    console.error(`❌ Server không phản hồi sau ${WAIT_TIMEOUT_MS / 1000}s. Hủy kiểm thử.`);
    serverProcess.kill();
    process.exit(1);
  }

  console.log('✅  Server sẵn sàng. Bắt đầu chạy test...\n');

  let exitCode = 0;

  try {
    // Chạy test-realtime
    const realtimeCode = await runScript(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['tsx', path.resolve(process.cwd(), 'scripts/test-realtime.ts')],
      process.cwd()
    );
    if (realtimeCode !== 0) exitCode = realtimeCode;

    // Chạy test-features nếu tồn tại
    const featuresScript = path.resolve(process.cwd(), 'scripts/test-features.ts');
    try {
      const { existsSync } = await import('fs');
      if (existsSync(featuresScript)) {
        const featuresCode = await runScript(
          process.platform === 'win32' ? 'npx.cmd' : 'npx',
          ['tsx', featuresScript],
          process.cwd()
        );
        if (featuresCode !== 0) exitCode = featuresCode;
      }
    } catch {
      // test-features không bắt buộc
    }
  } finally {
    console.log('\n🛑  Tắt server kiểm thử...');
    serverProcess.kill('SIGTERM');
    await sleep(500);
    if (!serverProcess.killed) serverProcess.kill('SIGKILL');
  }

  process.exit(exitCode);
}

main().catch((err) => {
  console.error('❌ Lỗi runner:', err.message);
  process.exit(1);
});
