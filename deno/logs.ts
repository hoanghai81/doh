// deno/logs.ts
interface LogEntry {
  time: number;
  hostname: string;
  type: string;
  action: "ALLOW" | "BLOCK";
  client: string;
}

const MAX_LOGS = 600;        // ~10 phút nếu 1 request/second
const MAX_AGE = 10 * 60 * 1000; // 10 phút

let logs: LogEntry[] = [];

export function addLog(
  hostname: string,
  type: string,
  action: "ALLOW" | "BLOCK",
  client: string,
) {
  const now = Date.now();

  logs.push({ time: now, hostname, type, action, client });

  if (logs.length > MAX_LOGS) logs.shift();

  // Dọn log quá cũ
  logs = logs.filter((l) => now - l.time < MAX_AGE);
}

export function getLogs() {
  const now = Date.now();
  logs = logs.filter((l) => now - l.time < MAX_AGE);
  return logs.slice().reverse();
      }
