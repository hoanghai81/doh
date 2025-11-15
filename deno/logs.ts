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
      let closed = false;

      const interval = setInterval(() => {
        try {
          if (closed) return;
          controller.enqueue(`data: ${logs.join("\n")}\n\n`);
        } catch {
          // client disconnect → stop enqueue
          closed = true;
          clearInterval(interval);
        }
      }, 1500);

      // Khi client đóng kết nối
      controller.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
      });
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/event-stream" },
  });
}
