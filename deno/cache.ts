// ===== DNS Cache dùng Deno KV =====
// Key: ["dns", qname, type]
// Value:
// {
//   expires: number,
//   response: string,
//   isBinary: boolean
// }

const kv = await Deno.openKv();

export async function getCache(qname: string, type: string) {
  const key = ["dns", qname, type];
  const entry = await kv.get(key);

  if (!entry.value) return null;

  if (entry.value.expires < Date.now()) {
    await kv.delete(key);
    return null;
  }

  return entry.value;
}

export async function setCache(
  qname: string,
  type: string,
  upstreamResp: Response,
  isBinary: boolean
) {
  let body: string;
  let ttl = 60;

  if (!isBinary) {
    const txt = await upstreamResp.text();
    body = txt;

    try {
      const data = JSON.parse(txt);
      if (Array.isArray(data.Answer) && data.Answer.length > 0) {
        ttl = Math.max(...data.Answer.map(a => a.TTL ?? 0));
      }
    } catch {
      ttl = 30;
    }

  } else {
    const buf = new Uint8Array(await upstreamResp.arrayBuffer());
    body = btoa(String.fromCharCode(...buf));
    ttl = 60;
  }

  const key = ["dns", qname, type];

  await kv.set(key, {
    expires: Date.now() + ttl * 1000,
    response: body,
    isBinary,
  });
}
