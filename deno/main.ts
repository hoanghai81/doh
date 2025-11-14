import { handleDnsJson, handleDnsMessage } from "./doh.ts";

const RAW = "https://raw.githubusercontent.com/hoanghai81/doh/main/modes";
const URLS = {
  base: `${RAW}/base.txt`,
  yt: `${RAW}/yt.txt`,
  tt: `${RAW}/tt.txt`,
  allow: `${RAW}/allow.txt`,
};

let sets = { base: new Set(), yt: new Set(), tt: new Set(), allow: new Set() };
let mode = "base";
let last = 0;
const TTL = 1000 * 60 * 10;

const TOKEN = Deno.env.get("MODE_TOKEN") || "";

async function loadLists(force = false) {
  if (!force && Date.now() - last < TTL) return;
  try {
    const [b, y, t, a] = await Promise.all([
      fetch(URLS.base).then(r => r.text()),
      fetch(URLS.yt).then(r => r.text()),
      fetch(URLS.tt).then(r => r.text()),
      fetch(URLS.allow).then(r => r.text()),
    ]);
    sets.base = toSet(b);
    sets.yt = toSet(y);
    sets.tt = toSet(t);
    sets.allow = toSet(a);
    last = Date.now();
  } catch (e) {
    console.error("Load error:", e);
  }
}

function toSet(text: string) {
  return new Set(
    text.split("\n")
      .map(x => x.trim().toLowerCase())
      .filter(Boolean)
  );
}

Deno.serve(async (req) => {
  try {
    await loadLists();

    const url = new URL(req.url);

    if (url.pathname === "/status") {
      return Response.json({
        mode,
        counts: {
          base: sets.base.size,
          yt: sets.yt.size,
          tt: sets.tt.size,
          allow: sets.allow.size,
        },
      });
    }

    if (url.pathname === "/setmode") {
      const t = url.searchParams.get("token");
      const m = url.searchParams.get("m");
      if (!TOKEN || t !== TOKEN) return new Response("401", { status: 401 });
      if (!["base", "yt", "tt"].includes(m!)) return new Response("400", { status: 400 });
      mode = m!;
      return Response.json({ ok: true, mode });
    }

    // DoH JSON GET
    if (url.pathname === "/dns-query" && url.searchParams.get("name")) {
      return await handleDnsJson(url.searchParams.get("name")!, sets, mode);
    }

    // Android PrivateDNS & DoH POST
    if (
      url.pathname === "/dns-query" ||
      url.pathname === "/.well-known/dns-query"
    ) {
      return await handleDnsMessage(req, sets, mode);
    }

    return new Response("OK");
  } catch (err) {
    console.log("Handled error:", err?.message);
    return new Response("err", { status: 200 });
  }
});
