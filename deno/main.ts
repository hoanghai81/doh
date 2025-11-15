import {
  handleDnsJson,
  handleDnsWireformat,
} from "./doh.ts";

Deno.serve((request: Request) => {
  const url = new URL(request.url);

  if (url.pathname === "/dns-query") {
    if (request.method === "GET") return handleDnsJson(request);
    if (request.method === "POST") return handleDnsWireformat(request);
  }

  return Response.json({
    status: "running",
    doh: "/dns-query",
    blocklist: "enabled",
  });
});
