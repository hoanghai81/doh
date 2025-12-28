// blocklist.ts
// Loads allow/block lists and keeps them in memory

const BLOCKLIST_URLS = [
#  "https://a.rawtv.top/youtube-blocker",
#  "https://a.rawtv.top/tiktok-blocker",
  "https://raw.githubusercontent.com/olbat/ut1-blacklists/master/blacklists/dating/domains",
  "https://raw.githubusercontent.com/Sinfonietta/hostfiles/master/gambling-hosts",
  "https://raw.githubusercontent.com/bigdargon/hostsVN/master/hosts",
  "https://raw.githubusercontent.com/r-a-y/mobile-hosts/master/AdguardDNS.txt",
  "https://easylist.to/easylist/easyprivacy.txt",
  "https://a.rawtv.top/deny"
];

const ALLOWLIST_URLS = [
  "https://raw.githubusercontent.com/nextdns/click-tracking-domains/main/domains",
  "https://raw.githubusercontent.com/AdguardTeam/HttpsExclusions/master/exclusions/banks.txt",
  "https://a.rawtv.top/allow"
];

// cached memory lists
let blockSet = new Set<string>();
let allowSet = new Set<string>();

// timestamp for cache
let lastLoad = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

// download + parse list
async function loadList(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const text = await res.text();

    return text
      .split("\n")
      .map((l) => l.trim().toLowerCase())
      .filter((l) =>
        l &&
        !l.startsWith("#") &&
        !l.startsWith("!") &&
        /^[a-z0-9.-]+$/.test(l.replace(/^0\.0\.0\.0\s*/, ""))
      )
      .map((l) => l.replace(/^0\.0\.0\.0\s*/, ""));
  } catch {
    return [];
  }
}

// public: load blocklists if expired
export async function ensureBlocklistsLoaded() {
  const now = Date.now();
  if (now - lastLoad < CACHE_TTL) return;

  console.log("[INFO] Reloading blocklists…");

  const blockPromises = BLOCKLIST_URLS.map(loadList);
  const allowPromises = ALLOWLIST_URLS.map(loadList);

  const blockResults = await Promise.all(blockPromises);
  const allowResults = await Promise.all(allowPromises);

  blockSet = new Set(blockResults.flat());
  allowSet = new Set(allowResults.flat());

  lastLoad = Date.now();

  console.log(
    `[INFO] Loaded blocklist=${blockSet.size} domains, allowlist=${allowSet.size} domains`,
  );
}

// public: check if domain is blocked
export function isBlocked(domain: string): boolean {
  domain = domain.toLowerCase();

  // allowlist wins over blocklist
  if (allowSet.has(domain)) return false;

  // exact domain match
  if (blockSet.has(domain)) return true;

  // wildcard check
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const sub = parts.slice(i).join(".");
    if (blockSet.has(sub)) return true;
  }

  return false;
    }
