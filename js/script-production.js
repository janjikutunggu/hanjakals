const API_BASE = "https://temp-mail-api.rayhanarditya88.workers.dev";

async function refreshMail() {
  const email = document.getElementById("addr").value.trim();
  if (!email) return alert("Alamat email belum dibuat!");

  const inboxUrl = `${API_BASE}/api/inbox?email=${encodeURIComponent(email)}`;
  showStatus("Loading...");

  try {
    const res = await fetch(inboxUrl);
    const data = await res.json();

    if (!data.messages || data.messages.length === 0) {
      showStatus("Tidak ada email baru");
      renderEmails([]);
      return;
    }

    showStatus("Online");
    renderEmails(data.messages, email);
  } catch (e) {
    showStatus("Failed to fetch");
    console.error(e);
  }
}

function renderEmails(messages, email) {
  const tbody = document.querySelector("#emails tbody");
  tbody.innerHTML = "";

  if (messages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Tidak ada email</td></tr>`;
    return;
  }

  messages.forEach((msg, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>-</td>
      <td><em>(Loading...)</em></td>
      <td>-</td>
      <td><button class="primary-button" onclick="loadMessage('${msg.id}', '${email}')">Buka</button></td>
    `;
    tbody.appendChild(tr);
    // Fetch detail per message
    fetchMessageDetails(msg.id, email, tr);
  });
}

async function fetchMessageDetails(id, email, rowEl) {
  try {
    const res = await fetch(`${API_BASE}/api/message?id=${id}&email=${email}`);
    const msg = await res.json();

    const cells = rowEl.querySelectorAll("td");
    cells[1].textContent = msg.from || "-";
    cells[2].textContent = msg.subject || "-";
    cells[3].textContent = msg.date || "-";
    cells[4].innerHTML = `<button class="primary-button" onclick="showMessage('${msg.subject}', '${msg.from}', \`${msg.body.replace(/`/g, "\\`")}\`)">📨 Lihat</button>`;
  } catch (e) {
    console.error("Gagal load detail", e);
  }
}

function showMessage(subject, from, body) {
  const html = `
    <div style="padding:20px; max-width:600px;">
      <h3>${subject}</h3>
      <p><strong>From:</strong> ${from}</p>
      <div style="margin-top:10px; padding:10px; border:1px solid #ddd; background:#fafafa;">
        ${body}
      </div>
    </div>
  `;
  const newWin = window.open("", "_blank", "width=600,height=400");
  newWin.document.write(html);
  newWin.document.close();
}

function genEmail() {
  const randomStr = Math.random().toString(36).substring(2, 10);
  const subdomain = document.getElementById("subdomain").value.trim() || "netapp.my.id";
  const email = `${randomStr}@${subdomain}`;
  document.getElementById("addr").value = email;
  refreshMail();
}

function showStatus(text) {
  const led = document.getElementById("status-led");
  const status = document.getElementById("status-text");
  status.textContent = text;
  led.className = "status-led " + (text === "Online" ? "online" : text === "Loading..." ? "loading" : "offline");
}
