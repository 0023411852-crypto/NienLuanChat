/**
 * KhoaChat — Test Runner (Windows/WSL-compatible)
 *
 * Hành vi:
 *  1. Kiểm tra cổng 4001 trước khi spawn server.
 *     - Nếu cổng trống   → spawn server mới, ghi nhớ PID để dọn.
 *     - Nếu KhoaChat đã lắng nghe (GET /api/health trả { ok:true, service:'khoachat' })
 *       → tái dùng server đó, KHÔNG spawn thêm, KHÔNG tắt khi xong.
 *     - Nếu cổng bị chiếm bởi tiến trình khác → báo lỗi rõ, dừng ngay.
 *  2. Chờ server phản hồi /api/health với chữ ký đúng (không nhận bất kỳ HTTP 2xx nào).
 *  3. Chạy test-realtime.ts và test-features.ts (nếu tồn tại).
 *     - Nếu KHÔNG có file test nào tồn tại → exit 1 (không báo giả thành công).
 *  4. Dọn tiến trình đúng cách trên Windows (taskkill /f /t, chờ kết thúc).
 */

import { spawn, execSync } from 'child_process';
import net from 'net';
import path from 'path';
import fs from 'fs';

// ─── Hằng số ───────────────────────────────────────────────────────────────
const SERVER_URL       = process.env.SERVER_URL || 'http://localhost:4001';
const HEALTH_URL       = `${SERVER_URL}/api/health`;
const HEALTH_SERVICE   = 'khoachat';           // chữ ký nhận dạng server
const ROOT_DIR         = path.resolve(__dirname, '..');
const SERVER_DIR       = path.join(ROOT_DIR, 'server');
const SCRIPTS_DIR      = path.join(ROOT_DIR, 'scripts');
const WAIT_TIMEOUT_MS  = 40_000;
const POLL_INTERVAL_MS = 600;
const IS_WIN           = process.platform === 'win32';

// ─── Tiện ích ───────────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Gọi GET /api/health và trả về dữ liệu nếu đúng chữ ký KhoaChat, null nếu không */
async function checkHealth(): Promise<{ ok: boolean; service: string; pid: number } | null> {
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res   = await fetch(HEALTH_URL, { signal: ctrl.signal }).catch(() => null);
    clearTimeout(timer);
    if (!res || !res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    // Fix B: validate đầy đủ các trường, kể cả pid phải là số nguyên dương
    if (
      data?.ok === true &&
      data?.service === HEALTH_SERVICE &&
      Number.isInteger(data?.pid) &&
      (data.pid as number) > 0
    ) {
      return data as { ok: boolean; service: string; pid: number };
    }
    return null;
  } catch {
    return null;
  }
}

/** Phân tích SERVER_URL để lấy chính xác host và port theo chuẩn giao thức */
function parseServerEndpoint(rawUrl: string): { host: string; port: number } {
  const parsed = new URL(rawUrl);
  const host = parsed.hostname || 'localhost';
  const defaultPort = parsed.protocol === 'https:' ? 443 : 80;
  const port = parsed.port ? parseInt(parsed.port, 10) : defaultPort;
  return { host, port };
}

/** Kiểm tra TCP port có đang được lắng nghe hay không (không phụ thuộc HTTP).
 *  Sử dụng đúng hostname từ SERVER_URL để tôn trọng cấu hình mạng (IPv4 / IPv6 / localhost). */
function isTcpPortInUse(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
  });
}

/** Poll /api/health cho đến khi KhoaChat phản hồi hoặc timeout */
async function waitForServer(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkHealth()) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

/** Dừng toàn bộ cây tiến trình của server đã spawn (Windows + Unix) */
function killTree(pid: number): void {
  try {
    if (IS_WIN) {
      execSync(`taskkill /pid ${pid} /f /t`, { stdio: 'pipe' });
    } else {
      process.kill(-pid, 'SIGKILL');   // kill cả process group
    }
  } catch {
    // Tiến trình có thể đã thoát – bỏ qua
  }
}

/** Chạy script tsx và trả về exit code */
function runTsx(scriptPath: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(`npx tsx "${scriptPath}"`, [], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      shell: true,
    });
    child.on('error', (err) => { console.error('Lỗi khi chạy script:', err.message); resolve(1); });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  // ── 1. Kiểm tra cổng trước khi spawn ──────────────────────────────────────
  const existingHealth = await checkHealth();
  let spawnedPid: number | null = null;
  let reusingExisting = false;

  if (existingHealth) {
    // KhoaChat đang chạy sẵn – dùng lại, không spawn thêm
    console.log(`♻️   KhoaChat đang chạy sẵn (PID ${existingHealth.pid}). Dùng lại, không spawn thêm.\n`);
    reusingExisting = true;
  } else {
    // Điểm A & B: Lấy đúng hostname và port theo protocol (80/443 hoặc port khai báo)
    const { host: serverHost, port: serverPort } = parseServerEndpoint(SERVER_URL);
    const portBusy = await isTcpPortInUse(serverPort, serverHost);

    if (portBusy) {
      console.error(`❌  Cổng ${serverHost}:${serverPort} đang bị chiếm bởi tiến trình KHÔNG PHẢI KhoaChat.`);
      console.error('    Hãy dừng tiến trình đó trước rồi chạy lại npm test.');
      process.exit(1);
    }

    // Cổng trống – spawn server mới
    console.log('🔧  Khởi động KhoaChat Server tạm thời để kiểm thử...');
    const serverProcess = spawn('npx tsx src/index.ts', [], {
      cwd: SERVER_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      env: {
        ...process.env,
        ...(process.env.DATABASE_URL_TEST
          ? { DATABASE_URL: process.env.DATABASE_URL_TEST }
          : {}),
      },
      // Tạo process group riêng để kill cả cây
      ...(IS_WIN ? {} : { detached: true }),
    });

    serverProcess.stdout?.on('data', (d: Buffer) =>
      d.toString().trim().split('\n').forEach(l => l && process.stdout.write(`  [server] ${l}\n`))
    );
    serverProcess.stderr?.on('data', (d: Buffer) =>
      d.toString().trim().split('\n').forEach(l => l && process.stderr.write(`  [server] ${l}\n`))
    );
    serverProcess.on('error', (err: Error) => {
      console.error('❌  Không thể khởi động server:', err.message);
      process.exit(1);
    });

    spawnedPid = serverProcess.pid ?? null;

    // ── 2. Chờ server sẵn sàng (xác minh chữ ký) ───────────────────────────
    console.log(`⏳  Chờ /api/health phản hồi đúng chữ ký (tối đa ${WAIT_TIMEOUT_MS / 1000}s)...`);
    const ready = await waitForServer(WAIT_TIMEOUT_MS);

    if (!ready) {
      console.error(`\n❌  Server không phản hồi sau ${WAIT_TIMEOUT_MS / 1000}s.`);
      console.error('    Kiểm tra DATABASE_URL và JWT_SECRET trong server/.env');
      if (spawnedPid) killTree(spawnedPid);
      process.exit(1);
    }

    const confirmedHealth = await checkHealth();
    // Fix C: nếu health-check trả về null ở đây, server đã crash sau khi đã sẵn sàng → dừng
    if (!confirmedHealth) {
      console.error('❌  Server không còn phản hồi ngay sau khi xác nhận sẵn sàng (đã crash?).');
      console.error('    Kiểm tra log server ở trên để tìm nguyên nhân.');
      if (spawnedPid) killTree(spawnedPid);
      process.exit(1);
    }
    console.log(`✅  Server sẵn sàng (PID ${confirmedHealth.pid}). Bắt đầu chạy test...\n`);
  }

  // ── 3. Phát hiện và chạy các script test ────────────────────────────────
  const testScripts = [
    path.join(SCRIPTS_DIR, 'test-realtime.ts'),
    path.join(SCRIPTS_DIR, 'test-features.ts'),
    path.join(SCRIPTS_DIR, 'test-security.ts'),
  ].filter(fs.existsSync);

  if (testScripts.length === 0) {
    console.error('❌  Không tìm thấy file test nào (test-realtime.ts, test-features.ts).');
    console.error('    Hãy kiểm tra thư mục scripts/.');
    if (spawnedPid) killTree(spawnedPid);
    process.exit(1);    // không báo giả thành công
  }

  let exitCode = 0;
  try {
    for (const script of testScripts) {
      console.log(`\n▶️   Chạy: ${path.relative(ROOT_DIR, script)}`);
      const code = await runTsx(script);
      if (code !== 0) exitCode = code;
    }
  } finally {
    // ── 4. Dọn server đã spawn (không dọn server tái dùng) ──────────────
    if (!reusingExisting && spawnedPid !== null) {
      console.log('\n🛑  Tắt server kiểm thử...');
      killTree(spawnedPid);
      await sleep(600);
    }
  }

  process.exit(exitCode);
}

main().catch((err: Error) => {
  console.error('❌  Lỗi runner:', err.message);
  process.exit(1);
});
