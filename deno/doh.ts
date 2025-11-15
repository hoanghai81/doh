// deno/doh.ts
import { addLog } from "./logs.ts";

// Load blocklist from root/modes/
const blockAll = await Deno.readTextFile("./modes/merged_block_all.txt")
  .then((t) => new Set(t.split("\n").map((l) => l.trim()).filter((x) => x)));

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function readName(view: DataView, offset: number): string {
  let labels: string[] = [];
  while (true) {
    const len = view.getUint8(offset);
    if (len === 0) break;
    offset++;

    const chars = [];
    for (let i = 0; i < len; i++) chars.push(String.fromCharCode(view.getUint8(offset + i)));
    offset += len;
    labels.push(chars.join(""));
  }
  return labels.join(".");
}

function nxdomain(req: Uint8Array): Uint8Array {
  const resp = new Uint8Array(req.length);
  resp.set(req);
  resp[2] |= 0x03; // NXDOMAIN
  return resp;
}

async function resolveUpstream(q: Uint8Array): Promise<Uint8Array> {
  const resp = await fetch("https://cloudflare-dns.com/dns-query", {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body: q,
  });
  return new Uint8Array(await resp.arrayBuffer());
}

export async function handleDnsQuery(body: Uint8Array, req: Request) {
  const view = new DataView(body.buffer);

  const qdcount = view.getUint16(4);
  if (qdcount !== 1) return nxdomain(body);

  let offset = 12;
  const hostname = readName(view, offset).toLowerCase();

  while (body[offset] !== 0) offset += body[offset] + 1;
  offset++;
  const qtype = view.getUint16(offset);

  const clientIp =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";

  let action: "ALLOW" | "BLOCK" = "ALLOW";
  if (blockAll.has(hostname)) action = "BLOCK";

  addLog(hostname, String(qtype), action, clientIp);

  if (action === "BLOCK") return nxdomain(body);

  return await resolveUpstream(body);
}
