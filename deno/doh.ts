// doh.ts
// Simple DoH resolver with option to inject blocklist later

// 🟩 Upstream DNS (Cloudflare DoH)
const UPSTREAM_DOH = "https://1.1.1.1/dns-query";

// 🟦 Handle application/dns-json (GET)
export async function handleDnsJson(request: Request): Promise<Response> {
  const url = new URL(request.url);

  const name = url.searchParams.get("name");
  const type = url.searchParams.get("type") ?? "A";

  if (!name) {
    return Response.json(
      { error: "missing `name` param" },
      { status: 400 },
    );
  }

  // Upstream URL
  const upstreamUrl = `${UPSTREAM_DOH}?name=${encodeURIComponent(name)}&type=${type}`;

  const upstreamResp = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      "accept": "application/dns-json",
    },
  });

  // Return upstream response as-is
  const body = await upstreamResp.text();
  return new Response(body, {
    status: upstreamResp.status,
    headers: {
      "content-type": "application/dns-json",
    },
  });
}

// 🟥 Handle DNS wireformat (POST)
export async function handleDnsWireformat(request: Request): Promise<Response> {
  const body = await request.arrayBuffer();

  const upstreamResp = await fetch(UPSTREAM_DOH, {
    method: "POST",
    headers: {
      "content-type": "application/dns-message",
    },
    body,
  });

  const respBody = await upstreamResp.arrayBuffer();

  return new Response(respBody, {
    status: upstreamResp.status,
    headers: {
      "content-type": "application/dns-message",
    },
  });
        }
