import { addLog } from "./logs.ts";

// Load blocklist
const blockAll = await Deno.readTextFile("./modes/merged_block_all.txt")
  .then((t) =>
    new Set(
      t.split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l),
    )
  )
  .catch(() => new Set<string>());

// Helper: đọc domain từ DNS packet
function readName(view: DataView, offset: number): string {
  const labels: string[] = [];
  while (true) {
    const len = view.getUint8(offset);
    if (len === 0) break;
    offset++;
    const chars = [];
    for (let i = 0; i < len; i++) {
      chars.push(String.fromCharCode(view.getUint8(offset + i)));
    }
    labels.push(chars.join(""));
    offset += len;
  }
  return labels.join(".");
}

// NXDOMAIN
function nxdomain(req: Uint8Array): Uint8Array {
  const resp = new Uint8Array(req.length);
  resp.set(req);
  resp[2] |= 0x03;
  return resp;
}

// Forward upstream → Cloudflare DNS
async function resolveUpstream(q: Uint8Array): Promise<Uint8Array> {
  const resp = await fetch("https://cloudflare-dns.com/dns-query", {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body: q,
  });
  return new Uint8Array(await resp.arrayBuffer());
}

// ============================================
// 🟢 EXPORT CHÍNH – QUAN TRỌNG
// ============================================
export async function handleDnsQuery(
  body: Uint8Array,
  req: Request,
): Promise<Uint8Array> {
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

  const action: "ALLOW" | "BLOCK" = blockAll.has(hostname)
    ? "BLOCK"
    : "ALLOW";

  // Ghi log
  addLog(hostname, String(qtype), action, clientIp);

  if (action === "BLOCK") return nxdomain(body);

  return await resolveUpstream(body);
}
