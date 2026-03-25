import { handleDnsJson, handleDnsWireformat } from "./deno/doh.ts";

Deno.serve((req) => {
  const url = new URL(req.url);

  if (url.pathname === "/dns-query") {
    if (req.method === "POST") {
      return handleDnsWireformat(req).then(r => r.response);
    } else {
      return handleDnsJson(req).then(r => r.response);
    }
  }

  return new Response("OK");
});
