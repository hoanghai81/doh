import {
  handleDnsJson,
  handleDnsWireformat,
} from "./doh.ts";
import { appendLog, serveLogsPage, serveLogsStream } from "./logs.ts";

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  // ---- Live Logs Routes (NEW but safe) ----
  if (url.pathname === "/logs") return serveLogsPage();
  if (url.pathname === "/logs/stream") return serveLogsStream();

  // ---- DOH Routes (KEEP EXACTLY LIKE ORIGINAL) ----
  if (url.pathname === "/dns-query") {
    if (request.method === "GET") {
      appendLog("GET JSON");
      return handleDnsJson(request);
    }
    if (request.method === "POST") {
      appendLog("POST WIREFORMAT");
      return handleDnsWireformat(request);
    }
  }

  // ---- Status ----
  return Response.json({
    status: "running",
    doh: "/dns-query",
    blocklist: "enabled",
    logs: "/logs",
  });
});
