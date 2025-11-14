// deno/main.ts
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/REPO_NAME/main/modes/base.txt";
const GITHUB_RAW_YT   = "https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/REPO_NAME/main/modes/yt.txt";
const GITHUB_RAW_TT   = "https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/REPO_NAME/main/modes/tt.txt";
const GITHUB_RAW_ALLOW = "https://raw.githubusercontent.com/YOUR_GITHUB_USERNAME/REPO_NAME/main/modes/allow.txt";

const CACHE_TTL = 1000 * 60 * 5; // 5 minutes
let lastLoad = 0;
let sets = { base: new Set<string>(), yt: new Set<string>(), tt: new Set<string>(), allow: new Set<string>() };
let currentMode: "base"|"yt"|"tt" = "base";
const RETHINK_UPSTREAM = "https://max.rethinkdns.com/dns-query"; // upstream DoH

function parseToSet(txt: string) {
  return new Set(
    txt.split(/\r?\n/).map(s => s.trim().toLowerCase())
      .map(s => s.replace(/^0\.0\.0\.0\s+/, "").replace(/^\s+|\s+$/g,""))
      .filter(Boolean)
  );
}

async function reloadIfNeeded() {
  const now = Date.now();
  if (now - lastLoad < CACHE_TTL) return;
  try {
    const [b,y,t,al] = await Promise.all([
      fetch(GITHUB_RAW_BASE).then(r => r.ok ? r.text() : ""),
      fetch(GITHUB_RAW_YT).then(r => r.ok ? r.text() : ""),
      fetch(GITHUB_RAW_TT).then(r => r.ok ? r.text() : ""),
      fetch(GITHUB_RAW_ALLOW).then(r => r.ok ? r.text() : "")
    ]);
    sets.base = parseToSet(b);
    sets.yt = parseToSet(y);
    sets.tt = parseToSet(t);
    sets.allow = parseToSet(al);
    lastLoad = now;
    console.log("Lists loaded:", sets.base.size, sets.yt.size, sets.tt.size, sets.allow.size);
  } catch(e) {
    console.error("Load lists failed", e);
  }
}

function isAllowed(name: string) {
  const n = name.toLowerCase();
  if (sets.allow.has(n)) return true;
  for (const a of sets.allow) {
    if (n === a) return true;
    if (n.endsWith("." + a)) return true;
  }
  return false;
}

function isBlocked(name: string) {
  const n = name.toLowerCase();
  const use = currentMode === "yt" ? sets.yt : currentMode === "tt" ? sets.tt : sets.base;
  if (use.has(n)) return true;
  for (const d of use) {
    if (n === d) return true;
    if (n.endsWith("." + d)) return true;
  }
  return false;
}

function nxResponse(name: string) {
  return JSON.stringify({ Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false, Question: [{name, type:1}], Answer: [] });
}

addEventListener("fetch", (evt) => {
  evt.respondWith(handle(evt.request));
});

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  await reloadIfNeeded();

  if (url.pathname === "/setmode") {
    const token = url.searchParams.get("token") || "";
    const expected = Deno.env.get("MODE_TOKEN") || "";
    if (!expected || token !== expected) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { "content-type":"application/json" }});
    }
    const m = url.searchParams.get("m");
    if (m === "base" || m === "yt" || m === "tt") {
      currentMode = m;
      return new Response(JSON.stringify({ ok: true, mode: currentMode }), { headers: {"content-type":"application/json"} });
    }
    return new Response(JSON.stringify({ error: "invalid mode" }), { status:400, headers: {"content-type":"application/json"} });
  }

  if (url.pathname === "/status") {
    return new Response(JSON.stringify({
      mode: currentMode,
      counts: { base: sets.base.size, yt: sets.yt.size, tt: sets.tt.size, allow: sets.allow.size },
      lastLoad
    }), { headers: {"content-type":"application/json"} });
  }

  if (url.pathname === "/dns-query") {
    const name = url.searchParams.get("name");
    if (!name) return new Response(JSON.stringify({ error: "no name param" }), { status:400, headers: {"content-type":"application/json"} });

    if (isAllowed(name)) {
      const upstream = RETHINK_UPSTREAM + "?name=" + encodeURIComponent(name);
      const r = await fetch(upstream, { headers: { accept: "application/dns-json" }});
      const text = await r.text();
      return new Response(text, { headers: { "content-type": r.headers.get("content-type") || "application/dns-json" }});
    }

    if (isBlocked(name)) {
      return new Response(nxResponse(name), { headers: { "content-type":"application/dns-json" }});
    }

    const upstream = RETHINK_UPSTREAM + "?name=" + encodeURIComponent(name);
    const r = await fetch(upstream, { headers: { accept: "application/dns-json" }});
    const text = await r.text();
    return new Response(text, { headers: { "content-type": r.headers.get("content-type") || "application/dns-json" }});
  }

  return new Response("Deno DoH Filter - /dns-query?name=example.com /setmode?m=base|yt|tt&token=xxx /status", { headers: {"content-type":"text/plain"} });
            }
