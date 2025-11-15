import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleDnsQuery } from "./doh.ts";
import { getLogs } from "./logs.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname === "/logs") {
    const html = await Deno.readTextFile("./deno/logs.html");
    return new Response(html, { headers: { "content-type": "text/html" }});
  }

  if (pathname === "/logs/json") {
    return new Response(JSON.stringify(getLogs()), {
      headers: { "content-type": "application/json" },
    });
  }

  if (pathname === "/status") {
    return new Response(JSON.stringify({
      status: "running",
      doh: "/dns-query",
      logs: "enabled"
    }), { headers: { "content-type": "application/json" }});
  }

  if (pathname === "/dns-query") {
    if (req.method === "POST") {
      const body = new Uint8Array(await req.arrayBuffer());
      const out = await handleDnsQuery(body, req);
      return new Response(out, { headers: { "content-type": "application/dns-message" }});
    }

    const dnsParam = url.searchParams.get("dns");
    if (dnsParam) {
      const body = Uint8Array.from(atob(dnsParam), (c) => c.charCodeAt(0));
      const out = await handleDnsQuery(body, req);
      return new Response(out, { headers: { "content-type": "application/dns-message" }});
    }

    return new Response("Bad Request", { status: 400 });
  }

  return new Response("DOH Server OK");
});
