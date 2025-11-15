import { ensureBlocklistsLoaded, isBlocked } from "./blocklist.ts";

const UPSTREAM_DOH = "https://1.1.1.1/dns-query";

// ===== DNS JSON Handler ===== //
export async function handleDnsJson(request: Request): Promise<Response> {
  await ensureBlocklistsLoaded();

  const url = new URL(request.url);
  const name = url.searchParams.get("name");
  const type = url.searchParams.get("type") ?? "A";

  if (!name) {
    return Response.json({ error: "missing name param" }, { status: 400 });
  }

  // block logic
  if (isBlocked(name)) {
    return Response.json({
      Status: 0,
      Answer: [],
      Comment: "Blocked by custom blocklist",
    });
  }

  // forward to upstream
  const upstream = `${UPSTREAM_DOH}?name=${encodeURIComponent(name)}&type=${type}`;
  const resp = await fetch(upstream, {
    headers: { "accept": "application/dns-json" },
  });

  return new Response(await resp.text(), {
    status: resp.status,
    headers: { "content-type": "application/dns-json" },
  });
}

// ===== Wireformat (POST) ===== //
export async function handleDnsWireformat(request: Request): Promise<Response> {
  await ensureBlocklistsLoaded();

  // TODO: parse wireformat later
  // for now always forward (blocklists only work for JSON GET mode)
  const body = await request.arrayBuffer();

  const resp = await fetch(UPSTREAM_DOH, {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body,
  });

  return new Response(await resp.arrayBuffer(), {
    status: resp.status,
    headers: { "content-type": "application/dns-message" },
  });
}
