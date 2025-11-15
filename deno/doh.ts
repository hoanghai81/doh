import { isBlocked } from "./blocklist.ts";

async function blockResponseJson(name: string) {
  return Response.json(
    {
      Status: 3, // NXDOMAIN
      Answer: [],
      Question: [{ name, type: 1 }],
    },
    {
      status: 200,
      headers: { "content-type": "application/dns-json" },
    },
  );
}

async function blockResponseWire() {
  // Return empty DNS packet
  return new Response(new Uint8Array(), {
    headers: { "content-type": "application/dns-message" },
    status: 200,
  });
}

export async function handleDnsJson(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const name = url.searchParams.get("name")?.toLowerCase();
  const type = url.searchParams.get("type") ?? "A";

  if (!name) {
    return Response.json({ error: "Missing name" }, { status: 400 });
  }

  // Check block
  if (await isBlocked(name)) {
    return blockResponseJson(name);
  }

  // Forward upstream
  const upstream = `https://1.1.1.1/dns-query?name=${name}&type=${type}`;
  const res = await fetch(upstream, {
    headers: { "accept": "application/dns-json" },
  });

  return new Response(await res.text(), {
    headers: { "content-type": "application/dns-json" },
    status: res.status,
  });
}

export async function handleDnsWireformat(request: Request): Promise<Response> {
  const body = new Uint8Array(await request.arrayBuffer());

  // Parse qname from DNS packet → very basic
  const domain = extractDomainFromWire(body);

  if (domain && await isBlocked(domain)) {
    return blockResponseWire();
  }

  const upstream = "https://1.1.1.1/dns-query";
  const res = await fetch(upstream, {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body,
  });

  return new Response(await res.arrayBuffer(), {
    headers: { "content-type": "application/dns-message" },
    status: res.status,
  });
}

// Minimal DNS parser (enough for blocking)
function extractDomainFromWire(buf: Uint8Array): string | null {
  try {
    let p = 12; // skip header
    let labels = [];
    while (buf[p] !== 0) {
      const len = buf[p];
      labels.push(new TextDecoder().decode(buf.slice(p + 1, p + 1 + len)));
      p += len + 1;
    }
    return labels.join(".").toLowerCase();
  } catch (_) {
    return null;
  }
}
