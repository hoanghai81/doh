// deno/doh.ts
const UPSTREAM = "https://max.rethinkdns.com/dns-query";

export async function handleDnsJson(name: string, sets: any, currentMode: string) {
  const q = name.toLowerCase();

  if (isAllowed(q, sets.allow)) {
    return await forwardJson(q);
  }
  if (isBlocked(q, sets, currentMode)) {
    return nxJson(q);
  }
  return await forwardJson(q);
}

export async function handleDnsMessage(req: Request, sets: any, currentMode: string) {
  const body = new Uint8Array(await req.arrayBuffer());

  // Extract QNAME from DNS message
  const qname = extractName(body);
  if (qname) {
    if (isAllowed(qname, sets.allow)) return await forwardMsg(body);
    if (isBlocked(qname, sets, currentMode)) return nxMsg(body);
  }

  return await forwardMsg(body);
}

// ---- helpers ----

function isAllowed(name: string, allow: Set<string>) {
  for (const a of allow)
    if (name === a || name.endsWith("." + a)) return true;
  return false;
}

function isBlocked(name: string, sets: any, mode: string) {
  const list = mode === "yt" ? sets.yt : mode === "tt" ? sets.tt : sets.base;
  for (const d of list)
    if (name === d || name.endsWith("." + d)) return true;
  return false;
}

function extractName(msg: Uint8Array) {
  try {
    let off = 12;
    const labels = [];
    while (true) {
      const len = msg[off++];
      if (!len) break;
      labels.push(new TextDecoder().decode(msg.slice(off, off + len)));
      off += len;
    }
    return labels.join(".").toLowerCase();
  } catch {
    return null;
  }
}

async function forwardJson(name: string) {
  const r = await fetch(UPSTREAM + "?name=" + name, {
    headers: { accept: "application/dns-json" },
  });
  return new Response(await r.text(), {
    headers: { "content-type": "application/dns-json" },
  });
}

async function forwardMsg(body: Uint8Array) {
  const r = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body,
  });
  return new Response(await r.arrayBuffer(), {
    headers: { "content-type": "application/dns-message" },
  });
}

function nxJson(name: string) {
  return Response.json({
    Status: 3,
    Question: [{ name, type: 1 }],
    Answer: [],
  });
}

function nxMsg(reqBody: Uint8Array) {
  // return same header ID but no answers
  const out = new Uint8Array(reqBody.length);
  out.set(reqBody);
  out[2] |= 0x03; // RCODE = 3 (NXDOMAIN)
  return new Response(out, {
    headers: { "content-type": "application/dns-message" },
  });
    }
