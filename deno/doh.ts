// deno/doh.ts
const RETHINK_UPSTREAM = "https://max.rethinkdns.com/dns-query"; // upstream DoH JSON

export async function dohHandler(req: Request, sets: any, currentMode: string): Promise<Response> {
  // Support both GET ?name=... (dns-json style) and POST binary (proxy pass)
  const url = new URL(req.url);

  // If GET with name param => handle json path
  const name = url.searchParams.get("name");
  if (name) {
    const q = name.toLowerCase();
    if (isAllowed(q, sets.allow)) {
      return await forwardToUpstream(q);
    }
    if (isBlocked(q, sets, currentMode)) {
      return nxResponse(q);
    }
    return await forwardToUpstream(q);
  }

  // If POST binary DNS message => proxy to upstream as-is (transparent)
  if (req.method === "POST") {
    // Proxy binary DNS message to upstream and return response
    const body = await req.arrayBuffer();
    const upstreamResp = await fetch(RETHINK_UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/dns-message" },
      body
    });
    const buf = await upstreamResp.arrayBuffer();
    return new Response(buf, {
      status: upstreamResp.status,
      headers: { "content-type": upstreamResp.headers.get("content-type") || "application/dns-message" }
    });
  }

  return new Response(JSON.stringify({ error: "no name param" }), { status: 400, headers: { "content-type": "application/json" }});
}

function nxResponse(name: string) {
  return new Response(JSON.stringify({ Status: 3, TC: false, RD: true, RA: true, Question: [{ name, type: 1 }], Answer: [] }), {
    headers: { "content-type": "application/dns-json" }
  });
}

async function forwardToUpstream(name: string) {
  const upstreamUrl = RETHINK_UPSTREAM + "?name=" + encodeURIComponent(name);
  const r = await fetch(upstreamUrl, { headers: { accept: "application/dns-json" }});
  const text = await r.text();
  return new Response(text, { headers: { "content-type": r.headers.get("content-type") || "application/dns-json" }});
}

function isAllowed(name: string, allowSet: Set<string>) {
  if (allowSet.has(name)) return true;
  for (const a of allowSet) {
    if (name === a) return true;
    if (name.endsWith("." + a)) return true;
  }
  return false;
}

function isBlocked(name: string, sets: any, mode: string) {
  const use = mode === "yt" ? sets.yt : mode === "tt" ? sets.tt : sets.base;
  if (use.has(name)) return true;
  for (const d of use) {
    if (name === d) return true;
    if (name.endsWith("." + d)) return true;
  }
  return false;
      }
