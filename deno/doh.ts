import { ensureBlocklistsLoaded, isBlocked } from "./blocklist.ts";

const UPSTREAM_DOH = "https://dns.nextdns.io";

export async function handleDnsJson(request: Request) {
  await ensureBlocklistsLoaded();

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const type = url.searchParams.get("type") ?? "A";

  if (!name) {
    return { response: Response.json({ error: "missing name" }, { status: 400 }), qName: null };
  }

  const lower = name.toLowerCase();
  if (isBlocked(lower)) {
    return {
      response: Response.json({
        Status: 0,
        Answer: [],
        Comment: "Blocked",
      }),
      qName: lower,
    };
  }

  const upstream = `${UPSTREAM_DOH}?name=${encodeURIComponent(name)}&type=${type}`;
  const upstreamResp = await fetch(upstream, {
    headers: { "accept": "application/dns-json" },
  });

  return {
    response: new Response(await upstreamResp.text(), {
      headers: { "content-type": "application/dns-json" },
    }),
    qName: lower,
  };
}

export async function handleDnsWireformat(request: Request) {
  await ensureBlocklistsLoaded();

  const buf = new Uint8Array(await request.arrayBuffer());
  const qName = extractNameFromWireformat(buf);

  if (qName && isBlocked(qName)) {
    const nxdomain = buildNXDomainResponse(buf);
    return {
      response: new Response(nxdomain, {
        headers: { "content-type": "application/dns-message" },
      }),
      qName,
    };
  }

  const upstreamResp = await fetch(UPSTREAM_DOH, {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body: buf,
  });

  return {
    response: new Response(await upstreamResp.arrayBuffer(), {
      headers: { "content-type": "application/dns-message" },
    }),
    qName,
  };
}

// Đoạn dưới vẫn giữ nguyên
function extractNameFromWireformat(data: Uint8Array): string | null {
  try {
    let pos = 12;
    const labels = [];
    while (true) {
      const len = data[pos];
      if (len === 0) break;
      if (len > 63) return null;
      labels.push(new TextDecoder().decode(data.slice(pos + 1, pos + 1 + len)));
      pos += len + 1;
    }
    return labels.join(".").toLowerCase();
  } catch {
    return null;
  }
}

function buildNXDomainResponse(query: Uint8Array): Uint8Array {
  const resp = new Uint8Array(query);
  resp[2] |= 0b10000000;
  resp[3] |= 0b00000011;
  resp[6] = 0;
  resp[7] = 0;
  return resp;
      }
