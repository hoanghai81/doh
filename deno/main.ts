import { handleDnsJson, handleDnsWireformat } from "./doh.ts";
import { logLine, serveLogs } from "./logs.ts";

Deno.serve((request: Request) => {
  const url = new URL(request.url);

  // xem log text
  if (url.pathname === "/logs") {
    return serveLogs();
  }

  // DOH
  if (url.pathname === "/dns-query") {
    if (request.method === "GET") {
      logLine("GET JSON");
      return handleDnsJson(request);
    }
    if (request.method === "POST") {
      logLine("POST WIREFORMAT");
      return handleDnsWireformat(request);
    }
  }

  // status
  return Response.json({
    status: "running",
    doh: "/dns-query",
    blocklist: "enabled",
    logs: "/logs"
  });
});
