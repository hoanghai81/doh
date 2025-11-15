// deno/doh.ts
import { addLog } from "./logs.ts";

// Load blocklist
const blockAll = await Deno.readTextFile("./deno/modes/merged_block_all.txt")
  .then((t) => new Set(t.split("\n").map((l) => l.trim()).filter((x) => x)));

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Parse DNS name from query
function readName(view: DataView, offset: number): string {
  let labels: string[] = [];
  while (true) {
    let len = view.getUint8(offset);
    if (len === 0) break;
    offset++;
    let parts = [];
    for (let i = 0; i < len; i++) {
      parts.push(String.fromCharCode(view.getUint8(offset + i)));
    }
    labels.push(parts.join(""));
    offset += len;
  }
  return labels.join(".");
}

// Create NXDOMAIN response
function nxdomain(request: Uint8Array): Uint8Array {
  const resp = new Uint8Array(request.length);
  resp.set(request);
  resp[2] |= 0x03; // rcode 3 = NXDOMAIN
  return resp;
}

// Forward allowed queries to 1.1.1.1
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

  // Move offset to qtype
  while (body[offset] !== 0) offset += body[offset] + 1;
  offset++;
  const qtype = view.getUint16(offset);

  const clientIp =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";

  // Check blocklist
  let action: "ALLOW" | "BLOCK" = "ALLOW";
  if (blockAll.has(hostname)) action = "BLOCK";

  // Log event
  addLog(hostname, String(qtype), action, clientIp);

  if (action === "BLOCK") return nxdomain(body);

  // Allow → forward to upstream
  return await resolveUpstream(body);
      }
