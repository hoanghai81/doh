// deno/main.ts
import { dohHandler } from "./doh.ts";

const REPO_RAW = "https://raw.githubusercontent.com/hoanghai81/doh/main/modes";
const URLS = {
  base: `${REPO_RAW}/base.txt`,
  yt: `${REPO_RAW}/yt.txt`,
  tt: `${REPO_RAW}/tt.txt`,
  allow: `${REPO_RAW}/allow.txt`,
};

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
let lastLoad = 0;
let sets: any = { base: new Set(), yt: new Set(), tt: new Set(), allow: new Set() };
let currentMode: "base" | "yt" | "tt" = "base";

// token from Deno Deploy secret MODE_TOKEN
const MODE_TOKEN = Deno.env.get("MODE_TOKEN") || "";

function parseToSet(txt: string) {
  return new Set(
    txt.split(/\r?\n/).map(s => s.trim().toLowerCase())
      .map(s => s.replace(/^0\.0\.0\.0\s+/, "").replace(/^\s+|\s+$/g,""))
      .filter(Boolean)
  );
}

async function reloadIfNeeded(force = false) {
  const now = Date.now();
  if (!force && now - lastLoad < CACHE_TTL) return;
  try {
    const [b,y,t,al] = await Promise.all([
      fetch(URLS.base).then(r => r.ok ? r.text() : ""),
      fetch(URLS.yt).then(r => r.ok ? r.text() : ""),
      fetch(URLS.tt).then(r => r.ok ? r.text() : ""),
      fetch(URLS.allow).then(r => r.ok ? r.text() : "")
    ]);
    sets.base = parseToSet(b);
    sets.yt = parseToSet(y);
    sets.tt = parseToSet(t);
    sets.allow = parseToSet(al);
    lastLoad = Date.now();
    console.log("Lists loaded:", sets.base.size, sets.yt.size, sets.tt.size, sets.allow.size);
  } catch (e) {
    console.error("Failed to load lists:", e);
  }
}

addEventListener("fetch", (evt) => {
  evt.respondWith(handle(evt.request));
});

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  // reload lists if expired
  await reloadIfNeeded();

  // status
  if (url.pathname === "/status") {
    return new Response(JSON.stringify({
      mode: currentMode,
      counts: { base: sets.base.size, yt: sets.yt.size, tt: sets.tt.size, allow: sets.allow.size },
      lastLoad
    }), { headers: { "content-type": "application/json" }});
  }

  // reload (protected)
  if (url.pathname === "/reload") {
    const token = url.searchParams.get("token") || "";
    if (!MODE_TOKEN || token !== MODE_TOKEN) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type":"application/json" }});
    }
    await reloadIfNeeded(true);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type":"application/json" }});
  }

  // set mode (protected)
  if (url.pathname === "/setmode" || url.pathname.startsWith("/mode/")) {
    const token = url.searchParams.get("token") || "";
    if (!MODE_TOKEN || token !== MODE_TOKEN) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type":"application/json" }});
    }
    // support query ?m=yt or /mode/yt
    let m = url.searchParams.get("m") || "";
    if (!m && url.pathname.startsWith("/mode/")) m = url.pathname.split("/").pop() || "";
    if (["base","yt","tt"].includes(m)) {
      currentMode = m as any;
      return new Response(JSON.stringify({ ok: true, mode: currentMode }), { headers: { "content-type":"application/json" }});
    }
    return new Response(JSON.stringify({ error: "invalid mode" }), { status: 400, headers: { "content-type":"application/json" }});
  }

  // Android and standard DoH endpoints
  if (url.pathname === "/.well-known/dns-query" || url.pathname === "/dns-query") {
    return dohHandler(req, sets, currentMode);
  }

  // root
  return new Response(`Custom DoH Server
Endpoints:
/dns-query (DoH JSON GET ?name=)
/.well-known/dns-query (Android)
 /status   -> info
 /setmode?m=base|yt|tt&token=XXX
 /reload?token=XXX
Current mode: ${currentMode}
Counts: base=${sets.base.size} yt=${sets.yt.size} tt=${sets.tt.size} allow=${sets.allow.size}
`, { headers: { "content-type": "text/plain" }});
                            }
