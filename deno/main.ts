import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { handleDnsQuery } from "./doh.ts";
import { getLogs } from "./logs.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const p = url.pathname;

  if (p === "/logs") {
    const html = await Deno.readTextFile("./deno/logs.html");
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  if (p === "/logs/json") {
    return new Response(JSON.stringify(getLogs()), {
      headers: { "content-type": "application/json" },
    });
  }

  if (p === "/status") {
    return new Response(
      JSON.stringify({ status: "running", logs: "ok", doh: "/dns-query" }),
      { headers: { "content-type": "application/json" } },
    );
  }

  if (p === "/dns-query") {
    // POST (DoH)
    if (req.method === "POST") {
      const body = new Uint8Array(await req.arrayBuffer());
      const resp = await handleDnsQuery(body, req);
      return new Response(resp, {
        headers: { "content-type": "application/dns-message" },
      });
    }

    // GET ?dns=
    const dns = url.searchParams.get("dns");
    if (dns) {
      const raw = Uint8Array.from(atob(dns), (c) => c.charCodeAt(0));
      const resp = await handleDnsQuery(raw, req);
      return new Response(resp, {
        headers: { "content-type": "application/dns-message" },
      });
    }

    return new Response("Bad Request", { status: 400 });
  }

  return new Response("OK", { status: 200 });
});
