let logs: string[] = [];
const LIMIT = 200;

export function logLine(line: string) {
  const t = new Date().toISOString();
  logs.push(`[${t}] ${line}`);
  if (logs.length > LIMIT) logs.shift();
}

export function serveLogs(): Response {
  return new Response(
    logs.join("\n"),
    {
      headers: { "content-type": "text/plain" }
    }
  );
}
