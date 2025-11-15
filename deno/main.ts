import { handleDnsJson, handleDnsWireformat } from "./doh.ts";
import { addLog, serveLogs } from "./logs.ts";
import { isBlocked } from "./blocklist.ts";

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);

  // logs page
  if (url.pathname === "/logs") {
    return serveLogs();
  }

  // DOH route
  if (url.pathname === "/dns-query") {
    if (request.method === "GET") {
      const { response, qName } = await handleDnsJson(request);

      if (qName) {
        addLog(qName, isBlocked(qName) ? "block" : "allow");
      }

      return response;
    }

    if (request.method === "POST") {
      const { response, qName } = await handleDnsWireformat(request);

      if (qName) {
        addLog(qName, isBlocked(qName) ? "block" : "allow");
      }

      return response;
    }
  }

  return Response.json({
    status: "running",
    doh: "/dns-query",
    logs: "/logs",
  });
});
