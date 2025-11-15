let logs: { time: string; host: string; status: "allow" | "block" | "unknown" }[] = [];
const LIMIT = 200;

export function addLog(host: string, status: "allow" | "block" | "unknown") {
  logs.push({
    time: new Date().toISOString(),
    host,
    status,
  });

  if (logs.length > LIMIT) logs.shift();
}

export function serveLogs(): Response {
  const rows = logs
    .map(
      (l) => `
      <tr>
        <td>${l.time}</td>
        <td>${l.host}</td>
        <td style="color:${
          l.status === "block" ? "red" : l.status === "allow" ? "lightgreen" : "gray"
        }">${l.status.toUpperCase()}</td>
      </tr>`
    )
    .join("");

  return new Response(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8"/>
      <title>DNS Logs</title>
      <style>
        body { background:#111; color:#fff; font-family: monospace; padding:20px; }
        table { width:100%; border-collapse: collapse; }
        td { padding:6px; border-bottom:1px solid #333; }
      </style>
    </head>
    <body>
      <h2>DNS Logs</h2>
      <table>
        <tr>
          <th>Time</th>
          <th>Hostname</th>
          <th>Status</th>
        </tr>
        ${rows}
      </table>
    </body>
    </html>
    `,
    { headers: { "content-type": "text/html" } }
  );
}
