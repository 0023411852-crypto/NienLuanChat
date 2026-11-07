/**
 * KhoaChat — Test Runner (Windows-compatible)
 * Tự động khởi động server, chờ sẵn sàng, chạy test, rồi tắt server.
 * Dùng: npx tsx scripts/run-tests.ts
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:4001';
const ROOT_DIR   = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(ROOT_DIR, 'server');
const WAIT_TIMEOUT_MS  = 40_000;  // tối đa 40 giây chờ server
const POLL_INTERVAL_MS = 600;

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
      if (res) return true;
    } catch {
      // bỏ qua, thử lại
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * Chạy một script tsx và trả về exit code.
 * Dùng shell:true để tương thích với Windows.
 */
function runTsx(scriptPath: string, cwd: string): Promise<number> {
  return new Promise((resolve) => {
    // Trên Windows, spawn với shell:true để cmd.exe tìm npx
    const child = spawn(`npx tsx "${scriptPath}"`, [], {
      cwd,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', (err) => {
      console.error('Lỗi khi chạy script:', err.message);
      resolve(1);
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  console.log('\n🔧  Khởi động server tạm thời để kiểm thử...');

  // Khởi động server bằng shell:true để tương thích Windows
  const serverProcess = spawn('npx tsx src/index.ts', [], {
    cwd: SERVER_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    env: { ...process.env },
    detached: false,
  });

  serverProcess.stdout?.on('data', (d: Buffer) => {
    const lines = d.toString().trim().split('\n');
    lines.forEach(l => l && process.stdout.write(`  [server] ${l}\n`));
  });
  serverProcess.stderr?.on('data', (d: Buffer) => {
    const lines = d.toString().trim().split('\n');
    lines.forEach(l => l && process.stderr.write(`  [server] ${l}\n`));
  });
  serverProcess.on('error', (err: Error) => {
    console.error('❌ Không thể khởi động server:', err.message);
    process.exit(1);
  });

  // Chờ server sẵn sàng
  console.log(`⏳  Chờ server phản hồi tại ${SERVER_URL} (tối đa ${WAIT_TIMEOUT_MS / 1000}s)...`);
  const ready = await waitForServer(SERVER_URL, WAIT_TIMEOUT_MS);

  if (!ready) {
    console.error(`\n❌  Server không phản hồi sau ${WAIT_TIMEOUT_MS / 1000}s.`);
    console.error('    Kiểm tra lại DATABASE_URL và JWT_SECRET trong server/.env');
    serverProcess.kill();
    process.exit(1);
  }

  console.log('✅  Server sẵn sàng. Bắt đầu chạy test...\n');

  let exitCode = 0;
  const scriptsDir = path.join(ROOT_DIR, 'scripts');

  try {
    // Chạy test-realtime
    const realtimePath = path.join(scriptsDir, 'test-realtime.ts');
    if (fs.existsSync(realtimePath)) {
      const code = await runTsx(realtimePath, ROOT_DIR);
      if (code !== 0) exitCode = code;
    } else {
      console.warn('⚠️  Không tìm thấy scripts/test-realtime.ts, bỏ qua.');
    }

    // Chạy test-features (không bắt buộc)
    const featuresPath = path.join(scriptsDir, 'test-features.ts');
    if (fs.existsSync(featuresPath)) {
      const code = await runTsx(featuresPath, ROOT_DIR);
      if (code !== 0) exitCode = code;
    }
  } finally {
    console.log('\n🛑  Tắt server kiểm thử...');
    // Trên Windows, kill toàn bộ cây tiến trình của shell
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'], { shell: true });
    } else {
      serverProcess.kill('SIGTERM');
    }
    await sleep(800);
  }

  process.exit(exitCode);
}

main().catch((err: Error) => {
  console.error('❌ Lỗi runner:', err.message);
  process.exit(1);
});
