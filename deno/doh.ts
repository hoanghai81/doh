import { addLog } from "./logs.ts";

// Load blocklist từ file merged tại root /modes/
const blockAll = await Deno.readTextFile("./modes/merged_block_all.txt")
  .then((t) =>
    new Set(
      t.split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l),
    )
  )
  .catch(() => new Set<string>());

const decoder = new TextDecoder();
const encoder = new TextEncoder();

// Hàm đọc tên domain từ packet DNS
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

// Tạo response NXDOMAIN
function nxdomain(req: Uint8Array): Uint8Array {
  const resp = new Uint8Array(req.length);
  resp.set(req);
  resp[2] |= 0x03; // RCODE = 3 (NXDOMAIN)
  return resp;
}

// Forward query đến upstream (Cloudflare)
async function resolveUpstream(q: Uint8Array): Promise<Uint8Array> {
  const resp = await fetch("https://cloudflare-dns.com/dns-query", {
    method: "POST",
    headers: { "content-type": "application/dns-message" },
    body: q,
  });
  return new Uint8Array(await resp.arrayBuffer());
}

// Hàm chính xử lý DoH
export async function handleDnsQuery(body: Uint8Array, req: Request): Promise<Uint8Array> {
  const view = new DataView(body.buffer);
  const qdcount = view.getUint16(4);
  if (qdcount !== 1) {
    return nxdomain(body);
  }

  // Đọc hostname
  let offset = 12;
  const hostname = readName(view, offset).toLowerCase();

  // Tìm qtype
  while (body[offset] !== 0) {
    offset += body[offset] + 1;
  }
  offset++;
  const qtype = view.getUint16(offset);

  // Lấy IP client nếu có
  const clientIp =
    req.headers.get("x-forwarded-for") ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";

  // Kiểm tra block
  const action: "ALLOW" | "BLOCK" = blockAll.has(hostname) ? "BLOCK" : "ALLOW";

  // Ghi log
  addLog(hostname, String(qtype), action, clientIp);

  // Nếu BLOCK → trả NXDOMAIN
  if (action === "BLOCK") {
    return nxdomain(body);
  }

  // Nếu ALLOW → forward
  return await resolveUpstream(body);
}
