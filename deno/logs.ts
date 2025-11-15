let logs: string[] = [];
const LIMIT = 200;

export function appendLog(line: string) {
  const t = new Date().toISOString();
  logs.push(`[${t}] ${line}`);
  if (logs.length > LIMIT) logs.shift();
}

export function serveLogsPage(): Response {
  return new Response(
    `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Live DNS Logs</title>
      <style>
        body { font-family: monospace; background:#111; color:#0f0; padding:20px; }
        #log { white-space:pre-wrap; }
      </style>
    </head>
    <body>
      <h2>Live DNS Logs</h2>
      <div id="log">Loading...</div>

      <script>
        const logDiv = document.getElementById("log");
        const es = new EventSource("/logs/stream");
        es.onmessage = (e) => { logDiv.textContent = e.data; };
      </script>
    </body>
    </html>`,
    { headers: { "content-type": "text/html" } }
  );
}

export function serveLogsStream(): Response {
  const body = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        try {
          controller.enqueue(`data: ${logs.join("\n")}\n\n`);
        } catch (_e) {
          // client closed → stop sending
          clearInterval(interval);
        }
      }, 1500);
    },
    cancel() {
      // Called when client closes connection
      // No need to do anything else
    }
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    },
  });
  }
