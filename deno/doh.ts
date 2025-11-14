// deno/doh.ts — DoH handler (RFC 8484)

export async function dohHandler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const dnsQuery = new Uint8Array(await req.arrayBuffer());

  const upstream = "https://dns.google/dns-query";

  const upstreamResp = await fetch(upstream, {
    method: "POST",
    headers: {
      "Content-Type": "application/dns-message"
    },
    body: dnsQuery,
  });

  const body = new Uint8Array(await upstreamResp.arrayBuffer());

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/dns-message"
    }
  });
    }
