import { handleDnsJson, handleDnsWireformat } from "./deno/doh.ts";
import { serveLogs, addLog } from "./deno/logs.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // LOG VIEW
  if (url.pathname === "/logs") {
    return serveLogs();
  }

  // DOH
  if (url.pathname === "/dns-query") {
    let result;

    if (req.method === "POST") {
      result = await handleDnsWireformat(req);
    } else {
      result = await handleDnsJson(req);
    }

    // 🔥 LOG TẠI ĐÂY
    if (result.qName) {
      addLog(result.qName, "allow"); // default
    }

    return result.response;
  }

  return new Response("OK");
});
