// blocklist.ts
// Load merged blocklist from GitHub raw

let cache: Set<string> | null = null;
let lastLoad = 0;

const LIST_URL =
  "https://raw.githubusercontent.com/hoanghai81/doh/refs/heads/main/modes/merged_block_all.txt";

export async function loadBlocklist() {
  const now = Date.now();
  if (cache && now - lastLoad < 60 * 60 * 1000) return cache; // cache 1h

  try {
    const res = await fetch(LIST_URL);
    const text = await res.text();
    const lines = text
      .split("\n")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x && !x.startsWith("#"));

    cache = new Set(lines);
    lastLoad = now;
    console.log(`Loaded blocklist: ${cache.size} domains`);
  } catch (e) {
    console.error("Blocklist load error:", e);
    if (!cache) cache = new Set(); // fallback
  }

  return cache;
}

export async function isBlocked(domain: string): Promise<boolean> {
  const list = await loadBlocklist();
  domain = domain.toLowerCase();

  // Check:
  // domain → ads.google.com
  // suffix → *.doubleclick.net
  if (list.has(domain)) return true;

  const parts = domain.split(".");
  while (parts.length > 1) {
    parts.shift();
    if (list.has(parts.join("."))) return true;
  }

  return false;
              }
