let logs: { time: string; host: string; status: "allow" | "block" | "unknown" }[] = [];
const LIMIT = 200;

export function addLog(host: string, status: "allow" | "block" | "unknown") {
  logs.push({
    time: new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
    }),
    host,
    status,
  });

  if (logs.length > LIMIT) logs.shift();
}

export function serveLogs(): Response {
  const rows = logs
    .map(
      (l) => `
      <tr data-status="${l.status}">
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
        table { width:100%; border-collapse: collapse; margin-top:10px; }
        td, th { padding:6px; border-bottom:1px solid #333; }
        .filter-btns button {
          margin-right: 10px;
          padding: 6px 12px;
          background: #222;
          color: #fff;
          border: 1px solid #444;
          cursor: pointer;
          border-radius: 4px;
        }
        .filter-btns button.active {
          background: #555;
        }
      </style>
    </head>
    <body>
      <h2>DNS Logs</h2>

      <!-- Buttons lọc -->
      <div class="filter-btns">
        <button data-filter="all" class="active">ALL</button>
        <button data-filter="allow">ALLOW</button>
        <button data-filter="block">BLOCK</button>
      </div>

      <table>
        <tr>
          <th>Time</th>
          <th>Hostname</th>
          <th>Status</th>
        </tr>
        ${rows}
      </table>

      <script>
        const btns = document.querySelectorAll('.filter-btns button');
        const rows = document.querySelectorAll('tr[data-status]');

        btns.forEach(btn => {
          btn.addEventListener('click', () => {
            const filter = btn.dataset.filter;

            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            rows.forEach(r => {
              if (filter === 'all') {
                r.style.display = '';
              } else {
                r.style.display = r.dataset.status === filter ? '' : 'none';
              }
            });
          });
        });
      </script>

    </body>
    </html>
    `,
    { headers: { "content-type": "text/html" } }
  );
    }
