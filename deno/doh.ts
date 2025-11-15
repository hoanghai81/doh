import { ensureBlocklistsLoaded, isBlocked } from "./blocklist.ts";

const UPSTREAM_DOH = "https://1.1.1.1/dns-query";


// =====================================
// 1) JSON GET handler
// =====================================
export async function handleDnsJson(request: Request): Promise<Response> {
  await ensureBlocklistsLoaded();

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const type = url.searchParams.get("type") ?? "A";

  if (!name) {
    return Response.json({ error: "missing name" }, { status: 400 });
  }

  if (isBlocked(name)) {
    return Response.json({
      Status: 0,
      Answer: [],
      Comment: "Blocked by custom blocklist (JSON)",
    });
  }

  const upstream = `${UPSTREAM_DOH}?name=${encodeURIComponent(name)}&type=${type}`;
  const upstreamResp = await fetch(upstream, {
    headers: { "accept": "application/dns-json" },
  });

  return new Response(await upstreamResp.text(), {
    headers: { "content-type": "application/dns-json" },
  });
}


// =====================================
// 2) WIREFORMAT POST handler (REAL DOH)
// =====================================
export async function handleDnsWireformat(request: Request): Promise<Response> {
  await ensureBlocklistsLoaded();

  // parse DNS query name out of wireformat packet
  const buf = new Uint8Array(await request.arrayBuffer());
  const qName = extractNameFromWireformat(buf);

  // if could parse name AND is blocked → return NXDOMAIN
  if (qName && isBlocked(qName)) {
    const nxdomain = buildNXDomainResponse(buf);
    return new Response(nxdomain, {
      headers: { "content-type": "application/dns-message" },
    });
  }

  // otherwise forward request upstream
  const upstreamResp = await fetch(UPSTREAM_DOH, {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body: buf,
  });

  return new Response(await upstreamResp.arrayBuffer(), {
    headers: { "content-type": "application/dns-message" },
  });
}


// ========================================
// PARSE DNS NAME FROM WIREFORMAT
// ========================================
function extractNameFromWireformat(data: Uint8Array): string | null {
  try {
    let pos = 12; // skip header
    const labels = [];

    while (true) {
      const len = data[pos];
      if (len === 0) break;
      if (len > 63) return null; // invalid

      const label = new TextDecoder().decode(data.slice(pos + 1, pos + 1 + len));
      labels.push(label);
      pos += len + 1;
    }

    return labels.join(".").toLowerCase();
  } catch {
    return null;
  }
}


// ========================================
// BUILD NXDOMAIN RESPONSE
// ========================================
function buildNXDomainResponse(query: Uint8Array): Uint8Array {
  const resp = new Uint8Array(query);

  // Set response flags: QR=1, RCODE=3 (NXDOMAIN)
  resp[2] |= 0b10000000; // QR = response
  resp[3] |= 0b00000011; // RCODE = 3 (NXDOMAIN)

  // Answer count = 0
  resp[6] = 0;
  resp[7] = 0;

  return resp;
}
