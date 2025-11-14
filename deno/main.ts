// main.ts — support Android Private DNS + normal DoH

import { dohHandler } from "./doh.ts";

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // Android Private DNS endpoint
    if (url.pathname === "/.well-known/dns-query") {
      return dohHandler(req);
    }

    // Standard DoH endpoint
    if (url.pathname === "/dns-query") {
      return dohHandler(req);
    }

    // Status / homepage
    return new Response(
      "Custom DoH Server is running!\n" +
      "Endpoints:\n" +
      "• /dns-query (standard DoH)\n" +
      "• /.well-known/dns-query (Android Private DNS)\n",
      { status: 200 },
    );
  }
};
