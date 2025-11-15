import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleDnsQuery } from "./doh.ts";
import { getLogs } from "./logs.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Live logs UI
  if (pathname === "/logs") {
    const html = await Deno.readTextFile("./deno/logs.html");
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  // Live logs JSON
  if (pathname === "/logs/json") {
    return new Response(JSON.stringify(getLogs()), {
      headers: { "content-type": "application/json" },
    });
  }

  // Status endpoint
  if (pathname === "/status") {
    return new Response(
      JSON.stringify({
        status: "running",
        doh: "/dns-query",
        logs: "enabled",
      }),
      { headers: { "content-type": "application/json" } },
    );
  }

  // DoH endpoint
  if (pathname === "/dns-query") {
    if (req.method === "POST") {
      const body = new Uint8Array(await req.arrayBuffer());
      const resp = await handleDnsQuery(body, req);
      return new Response(resp, { headers: { "content-type": "application/dns-message" } });
    }
    // Nếu client dùng GET để gửi raw DNS (base64 trong param `dns`)
    const dnsParam = url.searchParams.get("dns");
    if (dnsParam) {
      const body = Uint8Array.from(atob(dnsParam), (c) => c.charCodeAt(0));
      const resp = await handleDnsQuery(body, req);
      return new Response(resp, { headers: { "content-type": "application/dns-message" } });
    }
    return new Response("Bad Request", { status: 400 });
  }

  // Default
  return new Response("DOH Server OK", { status: 200 });
});
